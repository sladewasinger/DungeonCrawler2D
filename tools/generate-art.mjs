/**
 * Atlas baker. Run `npm run art` to (re)bake the committed spritesheets:
 *
 *   packages/client/public/assets/tiles.png     — 64×64 tile atlas
 *   packages/client/public/assets/players.png   — 64×64 player sheet
 *   packages/client/public/assets/enemies.png   — 64×64 enemy sheet
 *   packages/client/src/render/atlas.json       — frame indices (source of truth)
 *
 * Terrain tiles come from the Craftpix "Free 2D Top-Down Pixel Dungeon
 * Asset Pack" in assets/pack/ (see its license.txt): 16×16 sources
 * upscaled 4×. Wall rendering follows the pack's own sample art — a
 * blob autotile whose rounded cobble edges wrap near-black interiors,
 * with the cobble-course bottom row acting as the south-facing wall.
 *
 * REPLACE-LATER ART (procedural placeholders, no pack equivalent):
 * stair treads, ledge-rim overlays, player + enemy sprites, area-effect
 * overlay tiles (fire/wet/poison/oil/smoke/steam), crafting table and
 * door tiles. The stash chest is from the pack's Objects.png.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = join(ROOT, "assets", "pack");
const ASSET_DIR = join(ROOT, "packages", "client", "public", "assets");
const ATLAS_JSON = join(ROOT, "packages", "client", "src", "render", "atlas.json");

const SRC_TILE = 16;
const TILE = 64;
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

function rect(img, x0, y0, w, h, [r, g, b, a = 255]) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const i = (y * img.width + x) * 4;
      if (a === 255) {
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      } else {
        const t = a / 255;
        img.data[i] = Math.round(r * t + img.data[i] * (1 - t));
        img.data[i + 1] = Math.round(g * t + img.data[i + 1] * (1 - t));
        img.data[i + 2] = Math.round(b * t + img.data[i + 2] * (1 - t));
        img.data[i + 3] = Math.max(img.data[i + 3], a);
      }
    }
  }
}

/** Draw a 16×16 string pixel-map scaled 4× at (cellX, cellY). */
function drawPixelMap(img, cellX, cellY, pixels, palette) {
  for (let row = 0; row < pixels.length; row++) {
    const line = pixels[row];
    for (let col = 0; col < line.length; col++) {
      const cell = line[col];
      if (cell === ".") continue;
      const color = palette[cell];
      rect(img, cellX + col * 4, cellY + row * 4, 4, 4, color);
    }
  }
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function hexPalette(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = hexToRgb(v);
  return out;
}

/** Deterministic PRNG (mulberry32) for procedural texture noise. */
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

// ── sources ────────────────────────────────────────────────────────

const wallsFloor = loadPng(join(PACK, "walls_floor.png"));
const objects = loadPng(join(PACK, "Objects.png"));
const cracks = loadPng(join(PACK, "decorative_cracks_floor.png"));

// (col, row) picks in the 16px grids, verified via contact sheets:
const FLOOR_A = [1, 6];
const FLOOR_B = [1, 10];
const WALL_FACE_A = [1, 3]; // masonry, reused for terrain cliff faces
const WALL_FACE_B = [11, 0];
const CRACK_A = [1, 9];
const CRACK_B = [4, 13];
// Blob autotile pieces (rounded cobble edges around dark interior):
const BLOB = {
  TL: [0, 0],
  T: [1, 0],
  TR: [2, 0],
  L: [0, 1],
  C: [1, 1],
  R: [2, 1],
  BL: [0, 4],
  B: [1, 4],
  BR: [2, 4],
  PILLAR: [4, 6], // small freestanding wall block
};
const CHEST = [8, 1]; // stash chest in Objects.png

const SANCTUARY_TINT = [0.55, 1.08, 0.92];
const LIP = [172, 182, 204];

// ── atlas layout ───────────────────────────────────────────────────

const COLS = 8;
const ROWS = 8;
const frameXY = (index) => [(index % COLS) * TILE, Math.floor(index / COLS) * TILE];

// Unique wall blob frames live at 40–49; the mask table maps each
// N/E/S/W open-neighbor bitmask (N=1, E=2, S=4, W=8) to a frame.
const WALL_FRAME = {
  C: 40,
  T: 41,
  R: 42,
  B: 43,
  L: 44,
  TR: 45,
  TL: 46,
  BR: 47,
  BL: 48,
  PILLAR: 49,
};
const WALL_AUTO = [
  WALL_FRAME.C, // 0: enclosed
  WALL_FRAME.T, // 1: N open
  WALL_FRAME.R, // 2: E open
  WALL_FRAME.TR, // 3: N+E
  WALL_FRAME.B, // 4: S open
  WALL_FRAME.B, // 5: N+S strip
  WALL_FRAME.BR, // 6: E+S
  WALL_FRAME.PILLAR, // 7: N+E+S
  WALL_FRAME.L, // 8: W open
  WALL_FRAME.TL, // 9: N+W
  WALL_FRAME.PILLAR, // 10: E+W strip
  WALL_FRAME.PILLAR, // 11: N+E+W
  WALL_FRAME.BL, // 12: S+W
  WALL_FRAME.PILLAR, // 13: N+S+W
  WALL_FRAME.PILLAR, // 14: E+S+W
  WALL_FRAME.PILLAR, // 15: isolated
];

const atlas = {
  tileSize: TILE,
  frames: {
    floor: [0, 1, 2, 3],
    sanctuary: [8, 9, 10, 11],
    stairs: 20,
    faceTall: [24, 25],
    faceShort: [26, 27],
    /** rim frame = rimBase + bitmask (S=1, E=2, W=4), masks 1..7 */
    rimBase: 31,
    /** wall frame by N/E/S/W open-neighbor bitmask */
    wallAuto: WALL_AUTO,
    areas: { fire: 50, wet: 51, poison: 52, oil: 53, smoke: 54, steam: 55 },
    interact: { craftingTable: 56, stash: 57, doorPersonal: 58, doorParty: 59 },
  },
  players: { self: 0, peer: 1 },
  enemies: { slime: 0, "plant-creeper": 1, skeleton: 2, spitter: 3 },
};

const tiles = makeImage(COLS * TILE, ROWS * TILE);

// Floors + sanctuary recolor.
const floorPicks = [FLOOR_A, FLOOR_B, FLOOR_A, FLOOR_B];
const floorDecals = [null, null, CRACK_A, CRACK_B];
atlas.frames.floor.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  blitTile(tiles, x, y, wallsFloor, floorPicks[i][0], floorPicks[i][1]);
  if (floorDecals[i]) blitTile(tiles, x, y, cracks, floorDecals[i][0], floorDecals[i][1]);
});
atlas.frames.sanctuary.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  blitTile(tiles, x, y, wallsFloor, floorPicks[i][0], floorPicks[i][1], { tint: SANCTUARY_TINT });
  if (floorDecals[i])
    blitTile(tiles, x, y, cracks, floorDecals[i][0], floorDecals[i][1], { tint: SANCTUARY_TINT });
});

// Wall blob autotile pieces.
for (const [name, frame] of Object.entries(WALL_FRAME)) {
  const [x, y] = frameXY(frame);
  const [c, r] = BLOB[name];
  blitTile(tiles, x, y, wallsFloor, c, r);
}

// Stairs: procedural treads (the pack staircases are diagonal art).
{
  const [x, y] = frameXY(atlas.frames.stairs);
  for (let t = 0; t < 4; t++) {
    const ty = y + t * 16;
    rect(tiles, x, ty, TILE, 12, [128, 134, 158]);
    rect(tiles, x, ty, TILE, 3, [176, 184, 206]);
    rect(tiles, x, ty + 12, TILE, 4, [42, 40, 58]);
  }
  rect(tiles, x, y, 4, TILE, [70, 70, 92]);
  rect(tiles, x + TILE - 4, y, 4, TILE, [70, 70, 92]);
}

// Terrain cliff faces: pack masonry + lip + base shadow.
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
  blitTile(tiles, x, y, wallsFloor, pick[0], pick[1], { brightness: 0.85, rows: SRC_TILE / 2 });
  rect(tiles, x, y, TILE, 4, LIP);
  rect(tiles, x, y + TILE / 2, TILE, 6, [0, 0, 0, 90]);
});

// Ledge-rim overlays.
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

// Area-effect overlay tiles (translucent; REPLACE-LATER art).
function paintArea(frame, seed, blobs) {
  const [x, y] = frameXY(frame);
  const r = rng(seed);
  for (const [color, count, alpha] of blobs) {
    for (let i = 0; i < count; i++) {
      const bx = Math.floor(r() * 14) * 4;
      const by = Math.floor(r() * 14) * 4;
      const size = (1 + Math.floor(r() * 2)) * 4;
      rect(tiles, x + bx, y + by, size, size, [...hexToRgb(color), alpha]);
    }
  }
}
{
  const A = atlas.frames.areas;
  // fire: layered oranges over a translucent base
  rect(tiles, ...frameXY(A.fire), TILE, TILE, [...hexToRgb("#d1491f"), 140]);
  paintArea(A.fire, 0xf1e, [
    ["#f07f26", 26, 220],
    ["#ffc84d", 14, 230],
    ["#7a1c08", 10, 180],
  ]);
  rect(tiles, ...frameXY(A.wet), TILE, TILE, [...hexToRgb("#2b5f8f"), 110]);
  paintArea(A.wet, 0x3e7, [
    ["#4d8fc4", 18, 150],
    ["#7fb8dd", 8, 130],
  ]);
  rect(tiles, ...frameXY(A.poison), TILE, TILE, [...hexToRgb("#3f7a2c"), 120]);
  paintArea(A.poison, 0x901, [
    ["#66a839", 20, 170],
    ["#9fd45e", 10, 140],
  ]);
  rect(tiles, ...frameXY(A.oil), TILE, TILE, [...hexToRgb("#17131f"), 170]);
  paintArea(A.oil, 0x011, [
    ["#2d2340", 16, 190],
    ["#494060", 6, 150],
  ]);
  rect(tiles, ...frameXY(A.smoke), TILE, TILE, [...hexToRgb("#55505e"), 110]);
  paintArea(A.smoke, 0x50e, [
    ["#7a7488", 18, 130],
    ["#39343f", 10, 120],
  ]);
  rect(tiles, ...frameXY(A.steam), TILE, TILE, [...hexToRgb("#cfd6e2"), 90]);
  paintArea(A.steam, 0x57e, [
    ["#eef2f8", 16, 110],
    ["#aab4c6", 8, 100],
  ]);
}

// Interactables: stash chest from the pack; crafting table + doors are
// procedural (REPLACE-LATER art).
{
  const I = atlas.frames.interact;
  {
    const [x, y] = frameXY(I.stash);
    blitTile(tiles, x, y, wallsFloor, FLOOR_A[0], FLOOR_A[1]);
    blitTile(tiles, x, y, objects, CHEST[0], CHEST[1]);
  }
  {
    // crafting table: workbench with tools
    const [x, y] = frameXY(I.craftingTable);
    blitTile(tiles, x, y, wallsFloor, FLOOR_A[0], FLOOR_A[1]);
    rect(tiles, x + 8, y + 16, 48, 36, hexToRgb("#6e4a28")); // tabletop
    rect(tiles, x + 8, y + 16, 48, 5, hexToRgb("#8a6136"));
    rect(tiles, x + 8, y + 47, 48, 5, hexToRgb("#4c3018"));
    rect(tiles, x + 12, y + 52, 8, 8, hexToRgb("#4c3018")); // legs
    rect(tiles, x + 44, y + 52, 8, 8, hexToRgb("#4c3018"));
    rect(tiles, x + 16, y + 22, 12, 6, hexToRgb("#b8b2c4")); // saw blade
    rect(tiles, x + 36, y + 24, 6, 14, hexToRgb("#8f8898")); // hammer
    rect(tiles, x + 34, y + 34, 10, 5, hexToRgb("#5b4a68"));
  }
  const paintDoor = (frame, glowHex) => {
    const [x, y] = frameXY(frame);
    const glow = hexToRgb(glowHex);
    rect(tiles, x + 8, y, 48, 60, hexToRgb("#241f2e")); // frame
    rect(tiles, x + 14, y + 6, 36, 54, [...glow, 200]); // glowing doorway
    rect(tiles, x + 20, y + 14, 24, 46, [...glow, 255]);
    rect(tiles, x + 8, y, 48, 4, LIP);
    rect(tiles, x + 8, y, 4, 60, [98, 92, 116]);
    rect(tiles, x + 52, y, 4, 60, [98, 92, 116]);
  };
  paintDoor(I.doorPersonal, "#e8b53e"); // gold: your door
  paintDoor(I.doorParty, "#59b7d8"); // blue: party door
}

// ── player + enemy sprites (procedural; REPLACE-LATER art) ─────────

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
  hexPalette({ O: "#241a10", h: "#f4cc6a", H: "#dfa93a", F: "#3a2c22", E: "#ffe9b0", C: "#c08a26", c: "#96691c", B: "#503c28", b: "#6e5438" }),
  hexPalette({ O: "#101a24", h: "#8ed2ec", H: "#4fa6cc", F: "#26303c", E: "#d9f2ff", C: "#3a7d9c", c: "#2c6079", B: "#39394a", b: "#4d4d63" }),
];

const players = makeImage(2 * TILE, TILE);
PLAYER_PALETTES.forEach((palette, p) => {
  drawPixelMap(players, p * TILE, 0, PLAYER_PIXELS, palette);
});

const ENEMY_SPRITES = [
  {
    // slime
    pixels: [
      "................",
      "................",
      "................",
      "................",
      "......OOOO......",
      "....OOssssOO....",
      "...OssssssssO...",
      "..OssSSssSSssO..",
      "..OssEEssEEssO..",
      ".OssssssssssssO.",
      ".OsshsssssshssO.",
      ".OssssssssssssO.",
      "..OssssssssssO..",
      "...OOssssssOO...",
      ".....OOOOOO.....",
      "................",
    ],
    palette: hexPalette({ O: "#12240f", s: "#4da13a", S: "#2c6e22", E: "#0e1c0b", h: "#8fd876" }),
  },
  {
    // plant-creeper
    pixels: [
      "................",
      "....L......L....",
      "...LLL....LLL...",
      "....LL....LL....",
      ".....L.OO.L.....",
      "....OOOppOOO....",
      "...OppppppppO...",
      "..OppMMMMMMppO..",
      "..OpMWMWMWMMpO..",
      "..OppMMMMMMppO..",
      "...OppppppppO...",
      "....OOppppOO....",
      "......Otto......",
      "......OttO......",
      ".....OttttO.....",
      "....OOOOOOOO....",
    ],
    palette: hexPalette({ O: "#152210", L: "#5a9c3f", p: "#3f7a2c", M: "#26170f", W: "#e8e0c8", t: "#6e4a28", o: "#152210" }),
  },
  {
    // skeleton
    pixels: [
      "................",
      ".....OOOOO......",
      "....ObbbbbO.....",
      "....ObEbEbO.....",
      "....ObbbbbO.....",
      ".....ObbbO......",
      "....OObbbOO.....",
      "...ObObbbObO....",
      "...ObObbbObO....",
      "...O.ObbbO.O....",
      ".....ObbbO......",
      "....OObObOO.....",
      "....Ob.b.bO.....",
      "....Ob.b.bO.....",
      "....OO.O.OO.....",
      "................",
    ],
    palette: hexPalette({ O: "#1a1a22", b: "#cfc9bc", E: "#3f1010" }),
  },
  {
    // spitter
    pixels: [
      "................",
      "................",
      "....O......O....",
      "...OsO....OsO...",
      "....OssOOssO....",
      "...OssssssssO...",
      "..OsEEssssEEsO..",
      "..OssssssssssO..",
      "..OssMMMMMMssO..",
      "..OsMwMwMwMMsO..",
      "..OssMMMMMMssO..",
      "...OssssssssO...",
      "....OssOOssO....",
      "...OsO....OsO...",
      "....O......O....",
      "................",
    ],
    palette: hexPalette({ O: "#20102a", s: "#7a4a9c", E: "#e8d24d", M: "#180a20", w: "#c9b8dd" }),
  },
];

const enemies = makeImage(ENEMY_SPRITES.length * TILE, TILE);
ENEMY_SPRITES.forEach((sprite, i) => {
  drawPixelMap(enemies, i * TILE, 0, sprite.pixels, sprite.palette);
});

// ── write ──────────────────────────────────────────────────────────

mkdirSync(ASSET_DIR, { recursive: true });
writePng(tiles, join(ASSET_DIR, "tiles.png"));
writePng(players, join(ASSET_DIR, "players.png"));
writePng(enemies, join(ASSET_DIR, "enemies.png"));
writeFileSync(ATLAS_JSON, JSON.stringify(atlas, null, 2) + "\n");

console.log(`wrote ${join(ASSET_DIR, "tiles.png")} (${tiles.width}×${tiles.height})`);
console.log(`wrote ${join(ASSET_DIR, "players.png")} (${players.width}×${players.height})`);
console.log(`wrote ${join(ASSET_DIR, "enemies.png")} (${enemies.width}×${enemies.height})`);
console.log(`wrote ${ATLAS_JSON}`);
