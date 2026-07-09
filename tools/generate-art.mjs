/**
 * Atlas baker. Run `npm run art` to (re)bake the committed spritesheets:
 *
 *   packages/client/public/assets/tiles.png     — 64×64 tile atlas
 *   packages/client/public/assets/players.png   — 64×64 player sheet
 *   packages/client/public/assets/enemies.png   — 64×64 enemy sheet
 *   packages/client/public/assets/pack-sheet.png — Tile Studio sheet ×2
 *   assets/topdown/tilesheet.png                — Tile Studio sheet ×1
 *   packages/client/src/render/atlas.json       — frame indices (source of truth)
 *
 * Terrain tiles come from the Cainos "Pixel Art Top Down — Basic" pack
 * in assets/topdown/ (32×32 sources upscaled 2×) — the same pack the
 * Tile Studio sheet composes, so generated terrain and hand-authored
 * stamps share one look. The Cainos sheets are free-form assemblies,
 * not a uniform grid, so every slice below is a measured pixel rect.
 * The Craftpix pack in assets/pack/ now supplies only the stash chest
 * (Objects.png).
 *
 * The Tile Studio sheet (custom hand-authored maps) is a separate,
 * combined sheet composed from the Cainos "Pixel Art Top Down — Basic"
 * pack in assets/topdown/ (32×32 tiles). See docs/TILESET.md for the
 * cell layout. tilesheet.png (32px) feeds the editor; pack-sheet.png
 * (same grid ×2 → 64px) feeds the in-game custom-map layer, so tile
 * indices agree between the two by construction.
 *
 * Wall grammar (Cainos pieces over the same autotile masks):
 *   - deep wall interior            → warm near-black flat
 *   - north edge (floor above)      → outlined smooth cap course
 *   - south edge (floor below)      → cap band + brick face + dark base
 *   - east/west edges               → smooth side-wall strips
 *   - 1-wide N-S wall               → side strips both edges, dark core
 *   - 1-tall E-W wall               → cap band + brick face (compressed)
 *   - floors                        → rough stone-ground tiles (6 variants)
 *   - sanctuary                     → smooth slab, teal-shifted + bevel ring
 *   - floor next to a wall          → soft dark shadow border overlay
 *
 * Staircases: single-step entries wear the pack's REAL staircase
 * objects (TX Struct) — a 2×3-tile south-face staircase and the E/W
 * wedge objects — baked as standalone sprites (stair-*.png) and
 * stamped over the tilemap by render/stairsprites.ts. Tread tiles
 * remain underneath for long ramps and north-edge entries.
 *
 * REPLACE-LATER ART (procedural placeholders, no pack equivalent):
 * ledge-rim overlays, player + enemy sprites, area-effect overlay
 * tiles (fire/wet/poison/oil/smoke/steam), crafting table and door
 * tiles. The stash chest is from the pack's Objects.png.
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
 * Blit an arbitrary source pixel rect to (dstX, dstY), upscaled by
 * `scale` (default 4× for the 16px Craftpix sources; Cainos 32px
 * sources pass 2). Coordinates are raw pixels, not grid cells.
 */
function blitRect(dst, dstX, dstY, src, sx, sy, w, h, opts = {}) {
  const { tint = [1, 1, 1], brightness = 1, alphaMul = 1, scale = SCALE } = opts;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const si = ((sy + py) * src.width + sx + px) * 4;
      const alpha = src.data[si + 3] * alphaMul;
      if (alpha < 8) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const tx = dstX + px * scale + dx;
          const ty = dstY + py * scale + dy;
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

/** blitRect, with the source slice rotated 90° clockwise (w×h → h×w). */
function blitRectRot90(dst, dstX, dstY, src, sx, sy, w, h, opts = {}) {
  const { tint = [1, 1, 1], brightness = 1, alphaMul = 1, scale = SCALE } = opts;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const si = ((sy + py) * src.width + sx + px) * 4;
      const alpha = src.data[si + 3] * alphaMul;
      if (alpha < 8) continue;
      const rx = h - 1 - py; // rotated dest coords
      const ry = px;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const tx = dstX + rx * scale + dx;
          const ty = dstY + ry * scale + dy;
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

const objects = loadPng(join(PACK, "Objects.png")); // stash chest only

// Terrain sources: the Cainos "Pixel Art Top Down — Basic" pack (32px
// tiles, upscaled 2×) — the same pack the Tile Studio sheet composes,
// so generated terrain and hand-authored stamps share one look.
const txStone = loadPng(join(ROOT, "assets", "topdown", "TX Tileset Stone Ground.png"));
const txWall = loadPng(join(ROOT, "assets", "topdown", "TX Tileset Wall.png"));
const txStruct = loadPng(join(ROOT, "assets", "topdown", "TX Struct.png"));
/** Cainos source-pixel → atlas-pixel (32px cells → 64px tiles). */
const K = (n) => n * 2;
const KS = { scale: 2 };

// Measured pixel rects in the Cainos sheets (verified against grid crops):
const C = {
  // TX Tileset Stone Ground — rough ground rows 5/7 (row 6 holds a ring)
  ground: [
    [0, 160],
    [32, 160],
    [64, 160],
    [0, 224],
    [32, 224],
    [64, 224],
  ],
  // smooth slab (the "built" surface): plain + stud-dotted interiors
  slabPlain: [32, 32],
  slabDotted: [192, 32],
  // the big slab's beveled edges + corners (sanctuary rim ring)
  slabBevelTop: [32, 0, 32, 6],
  slabBevelBottom: [32, 90, 32, 6],
  slabBevelLeft: [0, 32, 6, 32],
  slabBevelRight: [90, 32, 6, 32],
  slabCornTL: [0, 0, 10, 10],
  slabCornTR: [86, 0, 10, 10],
  slabCornBL: [0, 86, 10, 10],
  slabCornBR: [86, 86, 10, 10],
  // TX Tileset Wall — cap band, brick faces, 1-wide strip pieces
  capEdgeN: [192, 32, 32, 14], // outer top edge: outline + smooth cap course
  capEdgeS: [192, 138, 32, 14], // outer bottom edge bar (structure 2, row 4)
  face: [64, 128, 32, 32], // clean brick face (room front wall)
  faceWeathered: [64, 192, 32, 32], // weathered face w/ ledge lip on top
  faceWeatheredB: [96, 192, 32, 32], // crack variant
  faceBottom: [64, 249, 32, 5], // dark base edge (bottom brick course end)
  stripL: [32, 64, 10, 32], // room side wall, west edge (smooth bar)
  stripR: [118, 64, 10, 32], // room side wall, east edge
};

// TX Struct — the pack's real staircase pixels. N-S treads are the
// struct wall-face brick courses (the pack's own sample builds its
// south-descending staircases exactly this way); E-W treads are the
// same slice rotated 90° (the wedge staircases are free-form diagonal
// assemblies that don't slice into a repeatable tile).
const CS = {
  nsTread: [40, 72, 32, 32],
};

const CHEST = [8, 1]; // stash chest cell in Objects.png (16px grid)

const INK = hexToRgb("#2b241d"); // dark outline (Cainos brown-black)
const SLIVER = hexToRgb("#bdb6a5"); // light base edge ("sharp edge on bottom")
const SHADOW = hexToRgb("#2e2a24"); // darker wall border on floors
const LIP = [193, 186, 168];
// Floor-toned coat under every wall frame so rounded corners and slice
// gaps show floor, not the void behind the tilemap.
const BASECOAT = [139, 133, 119];
// Wall-top interior: dungeon dark with a warm cast (big wall masses
// read as void, matching the old grammar).
const WALL_DARK = [34, 29, 24];

// ── atlas layout ───────────────────────────────────────────────────

const COLS = 8;
const ROWS = 14;
const frameXY = (index) => [(index % COLS) * TILE, Math.floor(index / COLS) * TILE];

const F = {
  floor: [0, 1, 2, 3, 82, 83], // 82/83 live in the atlas tail (added later)
  sanctuary: [4, 5, 6, 7],
  stairs: 8,
  faceTall: [9, 10],
  faceShort: [11, 12],
  rimBase: 89, // + mask 1..15 (S=1, E=2, W=4, N=8) → 90..104; 13..20 retired
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
  stairsEW: 81,
  // rail overlays for authored stair runs (edge tiles get a railing)
  stairRailW: 84,
  stairRailE: 85,
  stairRailN: 86,
  stairRailS: 87,
  /** Wall brick face filling the wall's own cell (the cap layer renders
   * the top a full tile north — walls read two tiles tall). */
  wallFace: 88,
};

// ── Tile Studio combined sheet (Cainos top-down pack, 32px tiles) ──
// Cell layout — keep in sync with docs/TILESET.md:
//   rows  0–7 : Grass (cols 0–7) | Stone Ground (cols 8–15)
//   rows  8–23: Wall  (cols 0–15) | Props (cols 16–31)
//   rows 24–39: Plant (cols 0–15) | Struct (cols 16–31)
const TOPDOWN = join(ROOT, "assets", "topdown");
const TD_TILE = 32;
const TD_COLS = 32;
const TD_ROWS = 40;
const TD_LAYOUT = [
  ["TX Tileset Grass.png", 0, 0],
  ["TX Tileset Stone Ground.png", 8, 0],
  ["TX Tileset Wall.png", 0, 8],
  ["TX Props.png", 16, 8],
  ["TX Plant.png", 0, 24],
  ["TX Struct.png", 16, 24],
];

/** Copy src 1:1 into dst at a pixel offset. */
function copyInto(dst, dstX, dstY, src) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (y * src.width + x) * 4;
      const di = ((dstY + y) * dst.width + dstX + x) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
}

/** Nearest-neighbor integer upscale. */
function upscaled(src, factor) {
  const out = makeImage(src.width * factor, src.height * factor);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const si = ((y / factor | 0) * src.width + (x / factor | 0)) * 4;
      const di = (y * out.width + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

const studioSheet = makeImage(TD_COLS * TD_TILE, TD_ROWS * TD_TILE);
for (const [file, cellX, cellY] of TD_LAYOUT) {
  const img = loadPng(join(TOPDOWN, file));
  if (img.width % TD_TILE || img.height % TD_TILE) {
    throw new Error(`${file}: not a multiple of ${TD_TILE}px (${img.width}×${img.height})`);
  }
  copyInto(studioSheet, cellX * TD_TILE, cellY * TD_TILE, img);
}

const atlas = {
  tileSize: TILE,
  /** Tile Studio combined sheet ×2 — tileset for custom-map art. */
  packSheet: {
    image: "pack-sheet.png",
    tileSize: TILE,
    sourceTile: TD_TILE,
    cols: TD_COLS,
    rows: TD_ROWS,
  },
  frames: {
    floor: F.floor,
    sanctuary: F.sanctuary,
    stairs: F.stairs,
    /** E-W treads for ramps that climb east/west. */
    stairsEW: F.stairsEW,
    /** Stair-run railing overlays by run edge side. */
    stairRailW: F.stairRailW,
    stairRailE: F.stairRailE,
    stairRailN: F.stairRailN,
    stairRailS: F.stairRailS,
    wallFace: F.wallFace,
    faceTall: F.faceTall,
    faceShort: F.faceShort,
    /** rim frame = rimBase + bitmask (S=1, E=2, W=4, N=8), masks 1..15 */
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

// Rough Cainos stone ground — six seamless variants.
atlas.frames.floor.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  const [sx, sy] = C.ground[i % C.ground.length];
  blitRect(tiles, x, y, txStone, sx, sy, 32, 32, KS);
});

// Sanctuary: the smooth Cainos slab, teal-shifted — safety reads as
// "built" against the rough ground.
const TEAL = { ...KS, tint: [0.62, 1.04, 0.99] };
atlas.frames.sanctuary.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  const [sx, sy] = i % 2 === 0 ? C.slabPlain : C.slabDotted;
  blitRect(tiles, x, y, txStone, sx, sy, 32, 32, TEAL);
});

// ── wall autotile (16 frames by N/E/S/W open-neighbor mask) ────────

/**
 * Wall-top platform frame: the wall is terrain raised WALL_RISE, so
 * every mask draws the same thing — a dark top surface with Cainos
 * cap/strip outlines on whichever edges border lower ground. The south
 * FACE is no longer baked in here: it renders on the tile below via
 * the shared cliff-face overlay, same as any ledge.
 */
function drawWallTop(x, y, { n, e, s, w }) {
  rect(tiles, x, y, TILE, TILE, WALL_DARK);
  if (w) blitRect(tiles, x, y, txWall, ...C.stripL, KS);
  if (e) blitRect(tiles, x + TILE - K(10), y, txWall, ...C.stripR, KS);
  if (n) blitRect(tiles, x, y, txWall, ...C.capEdgeN, KS);
  if (s) blitRect(tiles, x, y + TILE - K(14), txWall, ...C.capEdgeS, KS);
}

for (let mask = 0; mask < 16; mask++) {
  const [x, y] = frameXY(F.wallBase + mask);
  drawWallTop(x, y, {
    n: !!(mask & 1),
    e: !!(mask & 2),
    s: !!(mask & 4),
    w: !!(mask & 8),
  });
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
  if (n) blitRect(tiles, x, y, txStone, ...C.slabBevelTop, TEAL);
  if (s) blitRect(tiles, x, y + TILE - K(6), txStone, ...C.slabBevelBottom, TEAL);
  if (w) blitRect(tiles, x, y, txStone, ...C.slabBevelLeft, TEAL);
  if (e) blitRect(tiles, x + TILE - K(6), y, txStone, ...C.slabBevelRight, TEAL);
  if (n && w) blitRect(tiles, x, y, txStone, ...C.slabCornTL, TEAL);
  if (n && e) blitRect(tiles, x + TILE - K(10), y, txStone, ...C.slabCornTR, TEAL);
  if (s && w) blitRect(tiles, x, y + TILE - K(10), txStone, ...C.slabCornBL, TEAL);
  if (s && e) blitRect(tiles, x + TILE - K(10), y + TILE - K(10), txStone, ...C.slabCornBR, TEAL);
}

// ── stairs: procedural treads (REPLACE-LATER; pack stairs are diagonal) ──

// The pack's real staircase pixels (TX Struct): N-S treads are the
// brick courses its own sample map uses for south-descending stairs;
// E-W treads are the same slice rotated so nosings run north-south.
{
  const [x, y] = frameXY(atlas.frames.stairs);
  blitRect(tiles, x, y, txStruct, ...CS.nsTread, KS);
}
{
  const [x, y] = frameXY(atlas.frames.stairsEW);
  blitRectRot90(tiles, x, y, txStruct, ...CS.nsTread, KS);
}
// Run-edge railings (overlays; the rails are what make it read STAIRS).
// Sliced from the wall sheet's smooth side strips and cap courses —
// the same trim the pack's own staircases wear.
{
  const [x, y] = frameXY(atlas.frames.stairRailW);
  blitRect(tiles, x, y, txWall, ...C.stripL, KS);
}
{
  const [x, y] = frameXY(atlas.frames.stairRailE);
  blitRect(tiles, x + TILE - K(10), y, txWall, ...C.stripR, KS);
}
{
  const [x, y] = frameXY(atlas.frames.stairRailN);
  blitRect(tiles, x, y, txWall, ...C.capEdgeN, KS);
}
{
  const [x, y] = frameXY(atlas.frames.stairRailS);
  blitRect(tiles, x, y + TILE - K(14), txWall, ...C.capEdgeS, KS);
}

// Wall face filling the wall's own cell: the visible base you collide
// with (the cap layer draws the top a full tile north, so the whole
// wall reads two tiles tall like the pack's own structures).
{
  const [x, y] = frameXY(atlas.frames.wallFace);
  blitRect(tiles, x, y, txWall, ...C.face, KS);
  blitRect(tiles, x, y + TILE - K(5), txWall, ...C.faceBottom, KS);
}

// ── terrain cliff faces: stacked brick courses from the pack ───────

atlas.frames.faceTall.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  const src = i === 0 ? C.faceWeathered : C.faceWeatheredB;
  blitRect(tiles, x, y, txWall, ...src, KS); // ledge lip is baked into row 6
  blitRect(tiles, x, y + TILE - K(5), txWall, ...C.faceBottom, KS);
  rect(tiles, x, y + TILE - 2, TILE, 2, [0, 0, 0, 120]);
});
atlas.frames.faceShort.forEach((frame, i) => {
  const [x, y] = frameXY(frame);
  const src = i === 0 ? C.faceWeathered : C.faceWeatheredB;
  blitRect(tiles, x, y, txWall, src[0], src[1], 32, 14, KS); // lip + one course
  blitRect(tiles, x, y + K(14), txWall, ...C.faceBottom, KS);
  rect(tiles, x, y + K(19) - 2, TILE, 2, [0, 0, 0, 120]);
});

// ── ledge-rim overlays (heights; REPLACE-LATER procedural) ─────────

for (let mask = 1; mask <= 15; mask++) {
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
  if (mask & 8) {
    // north drop — the platform's top border line
    rect(tiles, x, y, TILE, 4, LIP);
    rect(tiles, x, y + 4, TILE, 4, soft);
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
    blitRect(tiles, x, y, txStone, C.ground[0][0], C.ground[0][1], 32, 32, KS);
    blitRect(tiles, x, y, objects, CHEST[0] * 16, CHEST[1] * 16, 16, 16);
  }
  {
    // crafting table: workbench with tools (REPLACE-LATER art)
    const [x, y] = frameXY(I.craftingTable);
    blitRect(tiles, x, y, txStone, C.ground[1][0], C.ground[1][1], 32, 32, KS);
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

// ── full staircase objects (TX Struct) — standalone sprites ────────

// The pack's real staircases, baked ×2 like every other Cainos slice:
// a 2×3-tile south-face staircase (courses + side trim) and the two
// full wedge objects (slanted rails over a stringer). They're
// free-form multi-tile assemblies, not grid tiles, so they ship as
// standalone images that render/stairsprites.ts stamps over
// single-step entries (one object per entry, like the pack's sample
// map). Measured rects, clean (least-mossy) variants.
const STAIR_SPRITES = {
  ns: [32, 32, 64, 96], // south-face staircase, climbs north
  e: [48, 288, 90, 96], // wedge, tall side east — climbs east
  w: [184, 384, 88, 96], // wedge, tall side west — climbs west
};
/** The struct staircases carry grass tufts where they met the pack's
 * grass platforms — on our stone dungeon they read as olive bands.
 * Recolor olive pixels to a warm stone gray of the same luminance
 * (outlines and geometry untouched). */
function degrass(img) {
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 8) continue;
    const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
    if (g > 40 && b < g * 0.5) {
      const lum = 0.3 * r + 0.6 * g + 0.1 * b;
      img.data[i] = Math.min(255, Math.round(lum * 1.05));
      img.data[i + 1] = Math.round(lum);
      img.data[i + 2] = Math.round(lum * 0.82);
    }
  }
}

atlas.stairSprites = {};
const stairImages = {};
for (const [key, [sx, sy, w, h]] of Object.entries(STAIR_SPRITES)) {
  const img = makeImage(w * 2, h * 2);
  blitRect(img, 0, 0, txStruct, sx, sy, w, h, KS);
  degrass(img);
  stairImages[`stair-${key}.png`] = img;
  atlas.stairSprites[key] = { image: `stair-${key}.png`, w: w * 2, h: h * 2 };
}

// ── write ──────────────────────────────────────────────────────────

// The studio edits at 32px; the game stamps the same grid at 64px.
const packSheet = upscaled(studioSheet, TILE / TD_TILE);

mkdirSync(ASSET_DIR, { recursive: true });
for (const [file, img] of Object.entries(stairImages)) {
  writePng(img, join(ASSET_DIR, file));
  console.log(`wrote ${join(ASSET_DIR, file)} (${img.width}×${img.height})`);
}
writePng(tiles, join(ASSET_DIR, "tiles.png"));
writePng(players, join(ASSET_DIR, "players.png"));
writePng(enemies, join(ASSET_DIR, "enemies.png"));
writePng(studioSheet, join(TOPDOWN, "tilesheet.png"));
writePng(packSheet, join(ASSET_DIR, "pack-sheet.png"));
writeFileSync(ATLAS_JSON, JSON.stringify(atlas, null, 2) + "\n");

console.log(`wrote ${join(ASSET_DIR, "tiles.png")} (${tiles.width}×${tiles.height})`);
console.log(`wrote ${join(ASSET_DIR, "players.png")} (${players.width}×${players.height})`);
console.log(`wrote ${join(ASSET_DIR, "enemies.png")} (${enemies.width}×${enemies.height})`);
console.log(`wrote ${join(TOPDOWN, "tilesheet.png")} (${studioSheet.width}×${studioSheet.height})`);
console.log(`wrote ${join(ASSET_DIR, "pack-sheet.png")} (${packSheet.width}×${packSheet.height})`);
console.log(`wrote ${ATLAS_JSON}`);
