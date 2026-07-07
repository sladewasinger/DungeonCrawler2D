/**
 * Atlas baker. Run `npm run art` to (re)bake the committed spritesheets:
 *
 *   packages/client/public/assets/tiles.png     — 64×64 tile atlas
 *   packages/client/public/assets/players.png   — 64×64 player sheet
 *   packages/client/public/assets/enemies.png   — 64×64 enemy sheet
 *   packages/client/src/render/atlas.json       — frame indices (source of truth)
 *
 * Terrain tiles come from the Craftpix "Free 2D Top-Down Pixel Dungeon
 * Asset Pack" in assets/pack/ (see its license.txt): 16×16-scale sources
 * upscaled 4×. The pack pieces are free-form assemblies, not a grid, so
 * every slice below is a measured pixel rect from walls_floor.png.
 *
 * Wall grammar (matches the pack's own sample render):
 *   - deep wall interior            → near-black flat
 *   - north edge (floor above)      → dark outline + lit brick course
 *   - south edge (floor below)      → darker brick course "face" ending
 *                                     in a light base sliver (sharp edge)
 *   - east/west edges               → rounded cobble rim strips
 *   - 1-wide N-S wall               → solid brick strip; dark rounded cap
 *                                     at the top end, sliver at the bottom
 *   - 1-tall E-W wall               → outline + course + sliver, rounded ends
 *   - floors                        → the four white-brick tiles from the
 *                                     sheet's bottom-right corner
 *   - sanctuary                     → flat platform grey + bevel rim ring
 *   - floor next to a wall          → soft dark-grey shadow border overlay
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

/**
 * Blit an arbitrary source pixel rect to (dstX, dstY), upscaled 4×.
 * Coordinates are raw pixels in the source image, not grid cells.
 */
function blitRect(dst, dstX, dstY, src, sx, sy, w, h, opts = {}) {
  const { tint = [1, 1, 1], brightness = 1, alphaMul = 1 } = opts;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const si = ((sy + py) * src.width + sx + px) * 4;
      const alpha = src.data[si + 3] * alphaMul;
      if (alpha < 8) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const tx = dstX + px * SCALE + dx;
          const ty = dstY + py * SCALE + dy;
          if (tx < 0 || ty < 0 || tx >= dst.width || ty >= dst.height) continue;
          const di = (ty * dst.width + tx) * 4;
          const a = alpha / 255;
          for (let c = 0; c < 3; c++) {
            const v = Math.min(255, src.data[si + c] * tint[c] * brightness);
            dst.data[di + c] = Math.round(v * a + dst.data[di + c] * (1 - a));
          }
          dst.data[di + 3] = Math.max(dst.data[di + 3], Math.round(alpha));
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

/** Clear a pixel (used to round off outer corners). */
function clearPx(img, x, y, w = 1, h = 1) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
      img.data[(py * img.width + px) * 4 + 3] = 0;
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

// Measured pixel rects in walls_floor.png (verified against 8× crops):
const S = {
  // the four white-brick floor tiles, bottom-right corner of the sheet
  floor: [
    [176, 336],
    [192, 336],
    [176, 352],
    [192, 352],
  ],
  // free-standing square column, top-left of sheet (x1..44, y0..77):
  blackFill: [13, 14, 16, 16], // flat near-black wall-top interior
  rimTop: [13, 1, 16, 8], // cobble rim course, north edge
  rimLeft: [1, 14, 7, 16], // cobble rim strip, west edge
  rimRight: [38, 14, 7, 16], // cobble rim strip, east edge
  cornerTL: [1, 0, 11, 11],
  cornerTR: [34, 0, 11, 11],
  // arch-wall assembly (x48..143, y288..333): lit 16px-periodic brick course
  courseOutline: [64, 289, 16, 2],
  courseA: [64, 291, 16, 12],
  courseB: [80, 291, 16, 12],
  // single-course wall chunk with rounded ends at (48,195) 16×13
  endcapL: [48, 195, 6, 13],
  endcapR: [58, 195, 6, 13],
  // clean 2-wide vertical wall strip, right of sheet (x176..207, y240..335):
  // its outer halves compose a seamless 1-wide solid-brick strip
  vstripL: [176, 256, 8, 16],
  vstripR: [200, 256, 8, 16],
  // flat grey platform with beveled rim (x1..44, y79..127)
  platInterior: [15, 94, 16, 16],
  platBevelTop: [13, 80, 16, 7],
  platBevelBottom: [13, 120, 16, 7],
  platBevelLeft: [2, 94, 7, 16],
  platBevelRight: [37, 94, 7, 16],
  platCornTL: [2, 80, 10, 10],
  platCornTR: [34, 80, 10, 10],
  platCornBL: [2, 117, 10, 10],
  platCornBR: [34, 117, 10, 10],
};

const CHEST = [8, 1]; // stash chest cell in Objects.png (16px grid)

const INK = hexToRgb("#15141d"); // dark outline
const SLIVER = hexToRgb("#c6cbd9"); // light base edge ("sharp edge on bottom")
const SHADOW = hexToRgb("#2e3140"); // darker-grey wall border on floors
const LIP = [174, 184, 208];
// Floor-toned coat under every wall frame so rounded corners and slice
// gaps show floor, not the void behind the tilemap.
const BASECOAT = [121, 130, 153];

// ── atlas layout ───────────────────────────────────────────────────

const COLS = 8;
const ROWS = 11;
const frameXY = (index) => [(index % COLS) * TILE, Math.floor(index / COLS) * TILE];

const F = {
  floor: [0, 1, 2, 3],
  sanctuary: [4, 5, 6, 7],
  stairs: 8,
  faceTall: [9, 10],
  faceShort: [11, 12],
  rimBase: 13, // + mask 1..7 → 14..20
  wallBase: 21, // + N/E/S/W open-mask 0..15 → 21..36
  wallShadowBase: 37, // + adjacent-wall mask 1..15 → 38..52
  sancRimBase: 53, // + platform-edge mask 1..15 → 54..68
  areas: { fire: 69, wet: 70, poison: 71, oil: 72, smoke: 73, steam: 74 },
  interact: {
    craftingTable: 75,
    stash: 76,
    doorPersonal: 77,
    doorParty: 78,
    doorExit: 79,
    doorSafeRoom: 80,
  },
};

const atlas = {
  tileSize: TILE,
  frames: {
    floor: F.floor,
    sanctuary: F.sanctuary,
    stairs: F.stairs,
    faceTall: F.faceTall,
    faceShort: F.faceShort,
    /** rim frame = rimBase + bitmask (S=1, E=2, W=4), masks 1..7 */
    rimBase: F.rimBase,
    /** wall frame by N/E/S/W open-neighbor bitmask (N=1,E=2,S=4,W=8) */
    wallAuto: Array.from({ length: 16 }, (_, mask) => F.wallBase + mask),
    /** floor-side wall shadow = wallShadowBase + adjacent-wall bitmask */
    wallShadowBase: F.wallShadowBase,
    /** sanctuary bevel rim = sancRimBase + platform-edge bitmask */
    sancRimBase: F.sancRimBase,
    areas: F.areas,
    interact: F.interact,
  },
  players: { self: 0, peer: 1 },
  enemies: { slime: 0, "plant-creeper": 1, skeleton: 2, spitter: 3 },
};

const tiles = makeImage(COLS * TILE, ROWS * TILE);
const P = (n) => n * SCALE; // source-pixel → atlas-pixel

// ── floors ─────────────────────────────────────────────────────────

atlas.frames.floor.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  blitRect(tiles, x, y, wallsFloor, S.floor[i][0], S.floor[i][1], 16, 16);
});

// Sanctuary: the pack's flat platform grey (the current "lighter grey").
atlas.frames.sanctuary.forEach((frame) => {
  const [x, y] = frameXY(frame);
  blitRect(tiles, x, y, wallsFloor, ...S.platInterior);
});

// ── wall autotile (16 frames by N/E/S/W open-neighbor mask) ────────

/** Wall-top tile: black interior, course on N, rim strips on E/W. */
function drawWallTop(x, y, { n, e, w }) {
  blitRect(tiles, x, y, wallsFloor, ...S.blackFill);
  if (w) blitRect(tiles, x, y, wallsFloor, ...S.rimLeft);
  if (e) blitRect(tiles, x + P(16 - 7), y, wallsFloor, ...S.rimRight);
  if (n) {
    rect(tiles, x, y, TILE, P(1), INK);
    blitRect(tiles, x, y + P(1), wallsFloor, ...S.rimTop);
  }
  if (n && w) blitRect(tiles, x, y, wallsFloor, ...S.cornerTL);
  if (n && e) blitRect(tiles, x + P(16 - 11), y, wallsFloor, ...S.cornerTR);
  if (w) rect(tiles, x, y, P(1), P(1), BASECOAT);
  if (e) rect(tiles, x + TILE - P(1), y, P(1), P(1), BASECOAT);
}

/** South-facing brick face: darker course ending in the light sliver. */
function drawWallFace(x, y, { n, e, w }) {
  // seam to the wall-top tile above (or hard outline if floor above)
  rect(tiles, x, y, TILE, P(2), n ? INK : hexToRgb("#211f2c"));
  blitRect(tiles, x, y + P(2), wallsFloor, S.courseA[0], S.courseA[1], 16, 11, {
    brightness: 0.78,
  });
  rect(tiles, x, y + P(13), TILE, P(2), SLIVER);
  rect(tiles, x, y + P(15), TILE, P(1), INK);
  if (w) {
    blitRect(tiles, x, y + P(1), wallsFloor, ...S.endcapL, { brightness: 0.9 });
    rect(tiles, x, y + P(1), P(1), P(14), INK);
    rect(tiles, x, y, P(1), P(2), BASECOAT);
    rect(tiles, x, y + TILE - P(2), P(1), P(2), BASECOAT);
  }
  if (e) {
    blitRect(tiles, x + P(10), y + P(1), wallsFloor, ...S.endcapR, { brightness: 0.9 });
    rect(tiles, x + P(15), y + P(1), P(1), P(14), INK);
    rect(tiles, x + TILE - P(1), y, P(1), P(2), BASECOAT);
    rect(tiles, x + TILE - P(1), y + TILE - P(2), P(1), P(2), BASECOAT);
  }
}

/** 1-wide N-S wall: solid brick strip; cap at the top end, sliver at the bottom. */
function drawVStrip(x, y, { cap, base }) {
  blitRect(tiles, x, y, wallsFloor, ...S.vstripL);
  blitRect(tiles, x + P(8), y, wallsFloor, ...S.vstripR);
  if (cap) {
    // dark rounded cap: "black on top"
    rect(tiles, x + P(1), y, P(14), P(2), INK);
    rect(tiles, x, y + P(1), P(1), P(2), INK);
    rect(tiles, x + P(15), y + P(1), P(1), P(2), INK);
    rect(tiles, x + P(2), y + P(2), P(12), P(1), [96, 96, 122]);
    rect(tiles, x, y, P(1), P(1), BASECOAT);
    rect(tiles, x + P(15), y, P(1), P(1), BASECOAT);
  }
  if (base) {
    // "sharp edge on bottom"
    rect(tiles, x + P(1), y + P(13), P(14), P(2), SLIVER);
    rect(tiles, x + P(1), y + P(15), P(14), P(1), INK);
    rect(tiles, x, y + P(15), P(1), P(1), BASECOAT);
    rect(tiles, x + P(15), y + P(15), P(1), P(1), BASECOAT);
  }
}

for (let mask = 0; mask < 16; mask++) {
  const [x, y] = frameXY(F.wallBase + mask);
  rect(tiles, x, y, TILE, TILE, BASECOAT);
  const n = !!(mask & 1);
  const e = !!(mask & 2);
  const s = !!(mask & 4);
  const w = !!(mask & 8);
  if (e && w && !s) {
    drawVStrip(x, y, { cap: n, base: false }); // strip middle / north cap
  } else if (e && w && s && !n) {
    drawVStrip(x, y, { cap: false, base: true }); // strip south end
  } else if (e && w && s && n) {
    drawVStrip(x, y, { cap: true, base: true }); // isolated pillar
  } else if (s) {
    drawWallFace(x, y, { n, e, w }); // south face (walls, EW strips, ends)
  } else {
    drawWallTop(x, y, { n, e, w }); // wall top (interior + N/E/W edges)
  }
}

// ── floor-side wall shadow overlays ("darker grey border") ─────────

for (let mask = 1; mask < 16; mask++) {
  const [x, y] = frameXY(F.wallShadowBase + mask);
  // Wall to the north casts the strongest shadow (like the pack sample).
  if (mask & 1) {
    rect(tiles, x, y, TILE, P(4), [...SHADOW, 130]);
    rect(tiles, x, y + P(4), TILE, P(2), [...SHADOW, 60]);
  }
  if (mask & 2) {
    rect(tiles, x + TILE - P(3), y, P(3), TILE, [...SHADOW, 90]);
    rect(tiles, x + TILE - P(4), y, P(1), TILE, [...SHADOW, 45]);
  }
  if (mask & 8) {
    rect(tiles, x, y, P(3), TILE, [...SHADOW, 90]);
    rect(tiles, x + P(3), y, P(1), TILE, [...SHADOW, 45]);
  }
  if (mask & 4) {
    rect(tiles, x, y + TILE - P(2), TILE, P(2), [...SHADOW, 70]);
  }
}

// ── sanctuary bevel rim overlays (platform edge ring) ──────────────

for (let mask = 1; mask < 16; mask++) {
  const [x, y] = frameXY(F.sancRimBase + mask);
  const n = !!(mask & 1);
  const e = !!(mask & 2);
  const s = !!(mask & 4);
  const w = !!(mask & 8);
  if (n) blitRect(tiles, x, y, wallsFloor, ...S.platBevelTop);
  if (s) blitRect(tiles, x, y + P(16 - 7), wallsFloor, ...S.platBevelBottom);
  if (w) blitRect(tiles, x, y, wallsFloor, ...S.platBevelLeft);
  if (e) blitRect(tiles, x + P(16 - 7), y, wallsFloor, ...S.platBevelRight);
  if (n && w) blitRect(tiles, x, y, wallsFloor, ...S.platCornTL);
  if (n && e) blitRect(tiles, x + P(16 - 10), y, wallsFloor, ...S.platCornTR);
  if (s && w) blitRect(tiles, x, y + P(16 - 10), wallsFloor, ...S.platCornBL);
  if (s && e) blitRect(tiles, x + P(16 - 10), y + P(16 - 10), wallsFloor, ...S.platCornBR);
}

// ── stairs: procedural treads (REPLACE-LATER; pack stairs are diagonal) ──

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

// ── terrain cliff faces: stacked brick courses from the pack ───────

atlas.frames.faceTall.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  const course = i === 0 ? S.courseA : S.courseB;
  rect(tiles, x, y, TILE, P(1), LIP);
  rect(tiles, x, y + P(1), TILE, P(1), INK);
  blitRect(tiles, x, y + P(2), wallsFloor, course[0], course[1], 16, 7, { brightness: 0.85 });
  blitRect(tiles, x, y + P(9), wallsFloor, course[0], course[1], 16, 6, { brightness: 0.68 });
  rect(tiles, x, y + P(15), TILE, P(1), [0, 0, 0, 120]);
});
atlas.frames.faceShort.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  const course = i === 0 ? S.courseA : S.courseB;
  rect(tiles, x, y, TILE, P(1), LIP);
  rect(tiles, x, y + P(1), TILE, P(1), INK);
  blitRect(tiles, x, y + P(2), wallsFloor, course[0], course[1], 16, 5, { brightness: 0.8 });
  rect(tiles, x, y + P(7), TILE, P(1), [0, 0, 0, 120]);
});

// ── ledge-rim overlays (heights; REPLACE-LATER procedural) ─────────

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

// ── area-effect overlay tiles (translucent; REPLACE-LATER art) ─────

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

// ── interactables: stash chest from the pack; rest procedural ──────

{
  const I = atlas.frames.interact;
  {
    const [x, y] = frameXY(I.stash);
    blitRect(tiles, x, y, wallsFloor, S.floor[0][0], S.floor[0][1], 16, 16);
    blitRect(tiles, x, y, objects, CHEST[0] * 16, CHEST[1] * 16, 16, 16);
  }
  {
    // crafting table: workbench with tools (REPLACE-LATER art)
    const [x, y] = frameXY(I.craftingTable);
    blitRect(tiles, x, y, wallsFloor, S.floor[1][0], S.floor[1][1], 16, 16);
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
  paintDoor(I.doorExit, "#cfd4e2"); // pale: the way back
  paintDoor(I.doorSafeRoom, "#7fd8a8"); // green: safe room portal
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
