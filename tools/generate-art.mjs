/**
 * Atlas baker. Run `npm run art` to (re)bake the committed spritesheets:
 *
 *   packages/client/public/assets/tiles.png    — 64×64 tile atlas
 *   packages/client/public/assets/players.png  — 64×64 player sheet
 *   packages/client/src/render/atlas.json      — frame indices (source of truth)
 *
 * Terrain tiles are sourced from the Craftpix "Free 2D Top-Down Pixel
 * Dungeon Asset Pack" copied into assets/pack/ (see its license.txt),
 * extracted from the 16×16 sheets and upscaled 4× nearest-neighbor to
 * our 64×64 grid. Sanctuary tiles are the same floor recolored teal;
 * cliff faces reuse the pack's wall-face masonry; rim overlays and the
 * player sprites remain procedural. Deterministic: same inputs, same
 * bytes.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = join(ROOT, "assets", "pack");
const ASSET_DIR = join(ROOT, "packages", "client", "public", "assets");
const ATLAS_JSON = join(ROOT, "packages", "client", "src", "render", "atlas.json");

const SRC_TILE = 16; // pack tile size
const TILE = 64; // atlas tile size
const SCALE = TILE / SRC_TILE;

// ── image kit ──────────────────────────────────────────────────────

function makeImage(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function loadPng(path) {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: png.data };
}

function writePng(img, path) {
  const png = new PNG({ width: img.width, height: img.height });
  Buffer.from(img.data).copy(png.data);
  writeFileSync(path, PNG.sync.write(png));
}

/**
 * Copy one 16×16 source tile into a 64×64 atlas cell, upscaled 4×
 * nearest-neighbor. `tint` multiplies channels; `rows` limits which
 * source rows are copied (for half-height faces); alpha composites.
 */
function blitTile(dst, cellX, cellY, src, tileCol, tileRow, opts = {}) {
  const { tint = [1, 1, 1], rows = SRC_TILE, brightness = 1 } = opts;
  for (let sy = 0; sy < rows; sy++) {
    for (let sx = 0; sx < SRC_TILE; sx++) {
      const si = ((tileRow * SRC_TILE + sy) * src.width + tileCol * SRC_TILE + sx) * 4;
      const alpha = src.data[si + 3];
      if (alpha === 0) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const px = cellX + sx * SCALE + dx;
          const py = cellY + sy * SCALE + dy;
          const di = (py * dst.width + px) * 4;
          const a = alpha / 255;
          for (let c = 0; c < 3; c++) {
            const v = Math.min(255, src.data[si + c] * tint[c] * brightness);
            dst.data[di + c] = Math.round(v * a + dst.data[di + c] * (1 - a));
          }
          dst.data[di + 3] = Math.max(dst.data[di + 3], alpha);
        }
      }
    }
  }
}

/** Fill a rect in FINAL pixels. */
function rect(img, x0, y0, w, h, [r, g, b, a = 255]) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (y * img.width + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  }
}

// ── sources ────────────────────────────────────────────────────────

const wallsFloor = loadPng(join(PACK, "walls_floor.png"));
const cracks = loadPng(join(PACK, "decorative_cracks_floor.png"));

// (col, row) picks in the 16px grids (verified via contact sheet —
// the pack's staircase art is diagonal and doesn't tile, so stairs
// are drawn procedurally in the pack palette instead):
const FLOOR_A = [1, 6]; // bordered plate center
const FLOOR_B = [1, 10]; // smooth plate center
const WALL_TOP_A = [1, 1];
const WALL_TOP_B = [1, 2];
const WALL_FACE_A = [1, 3];
const WALL_FACE_B = [11, 0];
const CRACK_A = [1, 9];
const CRACK_B = [4, 13];

const SANCTUARY_TINT = [0.55, 1.08, 0.92]; // blue-grey → teal

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

// Floors: two plain picks + two decorated with pack crack decals.
const floorPicks = [FLOOR_A, FLOOR_B, FLOOR_A, FLOOR_B];
const floorDecals = [null, null, CRACK_A, CRACK_B];
atlas.frames.floor.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  blitTile(tiles, x, y, wallsFloor, floorPicks[i][0], floorPicks[i][1]);
  if (floorDecals[i]) blitTile(tiles, x, y, cracks, floorDecals[i][0], floorDecals[i][1]);
});

// Sanctuary: same floors, teal.
atlas.frames.sanctuary.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  blitTile(tiles, x, y, wallsFloor, floorPicks[i][0], floorPicks[i][1], {
    tint: SANCTUARY_TINT,
  });
  if (floorDecals[i])
    blitTile(tiles, x, y, cracks, floorDecals[i][0], floorDecals[i][1], {
      tint: SANCTUARY_TINT,
    });
});

// Wall tops and south-facing masonry faces.
[WALL_TOP_A, WALL_TOP_B].forEach((pick, i) => {
  const [x, y] = frameXY(atlas.frames.wall[i]);
  blitTile(tiles, x, y, wallsFloor, pick[0], pick[1]);
});
[WALL_FACE_A, WALL_FACE_B].forEach((pick, i) => {
  const [x, y] = frameXY(atlas.frames.wallFace[i]);
  blitTile(tiles, x, y, wallsFloor, pick[0], pick[1]);
});

// Stairs: procedural horizontal treads in the pack's palette (the
// pack's staircase art is a diagonal composition that doesn't tile).
{
  const [x, y] = frameXY(atlas.frames.stairs);
  for (let t = 0; t < 4; t++) {
    const ty = y + t * 16;
    rect(tiles, x, ty, TILE, 12, [128, 134, 158]); // tread
    rect(tiles, x, ty, TILE, 3, [176, 184, 206]); // tread lip
    rect(tiles, x, ty + 12, TILE, 4, [42, 40, 58]); // riser
  }
  rect(tiles, x, y, 4, TILE, [70, 70, 92]); // side rails
  rect(tiles, x + TILE - 4, y, 4, TILE, [70, 70, 92]);
}

// Cliff faces: the same masonry, slightly darkened, with a bright top
// lip (the ledge above) and a drop shadow at the base.
const LIP = [172, 182, 204];
atlas.frames.faceTall.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  const pick = i === 0 ? WALL_FACE_A : WALL_FACE_B;
  blitTile(tiles, x, y, wallsFloor, pick[0], pick[1], { brightness: 0.85 });
  rect(tiles, x, y, TILE, 4, LIP);
  rect(tiles, x, y + TILE - 8, TILE, 8, [0, 0, 0, 90]);
});
atlas.frames.faceShort.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  const pick = i === 0 ? WALL_FACE_A : WALL_FACE_B;
  blitTile(tiles, x, y, wallsFloor, pick[0], pick[1], {
    brightness: 0.85,
    rows: SRC_TILE / 2, // top half only; bottom stays transparent
  });
  rect(tiles, x, y, TILE, 4, LIP);
  rect(tiles, x, y + TILE / 2, TILE, 6, [0, 0, 0, 90]);
});

// Rim highlight overlays (procedural), one per S/E/W bitmask combo.
for (let mask = 1; mask <= 7; mask++) {
  const [x, y] = frameXY(atlas.frames.rimBase + mask);
  const soft = [LIP[0], LIP[1], LIP[2], 150];
  if (mask & 1) {
    rect(tiles, x, y + TILE - 4, TILE, 4, LIP);
    rect(tiles, x, y + TILE - 8, TILE, 4, soft);
  }
  if (mask & 2) {
    rect(tiles, x + TILE - 4, y, 4, TILE, LIP);
    rect(tiles, x + TILE - 8, y, 4, TILE, soft);
  }
  if (mask & 4) {
    rect(tiles, x, y, 4, TILE, LIP);
    rect(tiles, x + 4, y, 4, TILE, soft);
  }
}

// ── player sprites (procedural — the pack has no characters) ───────

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

const players = makeImage(2 * TILE, TILE);
PLAYER_PALETTES.forEach((palette, p) => {
  for (let row = 0; row < PLAYER_PIXELS.length; row++) {
    const line = PLAYER_PIXELS[row];
    for (let col = 0; col < line.length; col++) {
      const cell = line[col];
      if (cell === ".") continue;
      rect(players, p * TILE + col * 4, row * 4, 4, 4, hexToRgb(palette[cell]));
    }
  }
});

// ── write ──────────────────────────────────────────────────────────

mkdirSync(ASSET_DIR, { recursive: true });
writePng(tiles, join(ASSET_DIR, "tiles.png"));
writePng(players, join(ASSET_DIR, "players.png"));
writeFileSync(ATLAS_JSON, JSON.stringify(atlas, null, 2) + "\n");

console.log(`wrote ${join(ASSET_DIR, "tiles.png")} (${tiles.width}×${tiles.height})`);
console.log(`wrote ${join(ASSET_DIR, "players.png")} (${players.width}×${players.height})`);
console.log(`wrote ${ATLAS_JSON}`);
