#!/usr/bin/env node
// Generates public/assets/debug-tileset.png — the hand-drawn, mostly-solid-color debug
// tileset (docs/ASSUMPTIONS.md's autotile-debug lane): flat GRAY floors, PURPLE-GRAY
// walls with a BLACK 3px border on whichever edges the bitmask autotile module says are
// NOT the same material, HORIZONTAL-LINES stairs (climbs north/south), VERTICAL-LINES
// stairs (climbs east/west), a BROWN rounded-rect DOOR with a darker arch line (2.5D
// rotation lane: retires the legacy pack-art door path). Deterministic, no randomness — rerun manually
// (`node scripts/generateDebugTileset.mjs`) whenever the tile art or layout changes;
// output is committed like atlas.png/contact-sheet.png.
//
// Frame layout is owned by src/render/terrain/debugTileset.ts — this script's raster
// order (row-major, DEBUG_TILESET_COLS columns) MUST match that file's documented
// layout exactly, since Phaser's spritesheet loader assigns frame indices purely by
// raster position. The border-edge math mirrors autotile.ts's `edgesForMask4` (that
// file's the source of truth and is exhaustively unit-tested — this is a plain-node
// script with no TS toolchain, so the tiny 4-line rule is duplicated here, not imported).
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Canvas } from "../../../tools/lib/png-canvas.mjs";

const clientDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outPath = path.join(clientDir, "public", "assets", "debug-tileset.png");

const TILE_PX = 48;
const COLS = 4;
const FRAME_COUNT = 3 + 16 + 1; // floor, stairs-NS, stairs-EW, 16 wall mask4 variants, door

const FLOOR_GRAY = [0x8a, 0x8a, 0x8a, 0xff];
const WALL_PURPLE_GRAY = [0x6e, 0x64, 0x80, 0xff];
const BLACK = [0x00, 0x00, 0x00, 0xff];
const DOOR_BROWN = [0x8b, 0x5a, 0x2b, 0xff];
const DOOR_BROWN_DARK = [0x5a, 0x38, 0x1a, 0xff];

const BORDER_PX = 3;
const LINE_PX = 3;
const LINE_GAP_PX = 9;

/** Mirrors autotile.ts's `edgesForMask4`: a border draws on each edge whose cardinal
 * neighbor bit (bit0=N, bit1=E, bit2=S, bit3=W) is NOT set. */
function edgesForMask4(mask4) {
  return {
    north: (mask4 & 1) === 0,
    east: (mask4 & 2) === 0,
    south: (mask4 & 4) === 0,
    west: (mask4 & 8) === 0,
  };
}

function drawFloor(canvas, ox, oy) {
  canvas.fillRect(ox, oy, TILE_PX, TILE_PX, FLOOR_GRAY);
}

/** Crisp `thickness`-px lines every LINE_GAP_PX, spanning the tile perpendicular to `axis`. */
function drawStairLines(canvas, ox, oy, axis) {
  canvas.fillRect(ox, oy, TILE_PX, TILE_PX, FLOOR_GRAY);
  for (let pos = LINE_GAP_PX; pos < TILE_PX; pos += LINE_GAP_PX) {
    if (axis === "horizontal") canvas.fillRect(ox, oy + pos, TILE_PX, LINE_PX, BLACK);
    else canvas.fillRect(ox + pos, oy, LINE_PX, TILE_PX, BLACK);
  }
}

function drawWallVariant(canvas, ox, oy, mask4) {
  canvas.fillRect(ox, oy, TILE_PX, TILE_PX, WALL_PURPLE_GRAY);
  const edges = edgesForMask4(mask4);
  if (edges.north) canvas.fillRect(ox, oy, TILE_PX, BORDER_PX, BLACK);
  if (edges.south) canvas.fillRect(ox, oy + TILE_PX - BORDER_PX, TILE_PX, BORDER_PX, BLACK);
  if (edges.west) canvas.fillRect(ox, oy, BORDER_PX, TILE_PX, BLACK);
  if (edges.east) canvas.fillRect(ox + TILE_PX - BORDER_PX, oy, BORDER_PX, TILE_PX, BLACK);
}

/** True when (rx, ry) — coordinates relative to a `w`x`h` box — falls inside a rect
 * whose corners are rounded to `radius`: the plus-shaped core, or within `radius` of
 * whichever corner circle center is nearest. */
function insideRoundedRect(rx, ry, w, h, radius) {
  if (rx >= radius && rx < w - radius) return true;
  if (ry >= radius && ry < h - radius) return true;
  const cx = rx < radius ? radius : w - radius - 1;
  const cy = ry < radius ? radius : h - radius - 1;
  const dx = rx - cx;
  const dy = ry - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function fillRoundedRect(canvas, x, y, w, h, radius, rgba) {
  for (let ry = 0; ry < h; ry++) {
    for (let rx = 0; rx < w; rx++) {
      if (insideRoundedRect(rx, ry, w, h, radius)) canvas.setPixel(x + rx, y + ry, rgba);
    }
  }
}

/** A simple brown rounded-rect leaf with a darker arch line near the top (debug-tileset
 * language for doors — flat color + one accent line, same posture as floor/wall/stairs). */
const DOOR_MARGIN_PX = 4;
const DOOR_RADIUS_PX = 6;
const ARCH_RADIUS_PX = 13;
const ARCH_LINE_PX = 3;

function drawDoor(canvas, ox, oy) {
  canvas.fillRect(ox, oy, TILE_PX, TILE_PX, FLOOR_GRAY);
  const doorW = TILE_PX - DOOR_MARGIN_PX * 2;
  const doorH = TILE_PX - DOOR_MARGIN_PX * 2;
  fillRoundedRect(canvas, ox + DOOR_MARGIN_PX, oy + DOOR_MARGIN_PX, doorW, doorH, DOOR_RADIUS_PX, DOOR_BROWN);
  // Arch line: the upper half of a circle centered a bit below the door's top edge.
  const archCx = ox + TILE_PX / 2;
  const archCy = oy + DOOR_MARGIN_PX + ARCH_RADIUS_PX + 2;
  for (let dy = -ARCH_RADIUS_PX; dy <= 0; dy++) {
    for (let dx = -ARCH_RADIUS_PX; dx <= ARCH_RADIUS_PX; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(dist - ARCH_RADIUS_PX) <= ARCH_LINE_PX / 2) {
        canvas.setPixel(Math.round(archCx + dx), Math.round(archCy + dy), DOOR_BROWN_DARK);
      }
    }
  }
}

function frameOrigin(index) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return { ox: col * TILE_PX, oy: row * TILE_PX };
}

function run() {
  const rows = Math.ceil(FRAME_COUNT / COLS);
  const canvas = new Canvas(COLS * TILE_PX, rows * TILE_PX);

  const { ox: floorX, oy: floorY } = frameOrigin(0);
  drawFloor(canvas, floorX, floorY);

  const { ox: nsX, oy: nsY } = frameOrigin(1);
  drawStairLines(canvas, nsX, nsY, "horizontal");

  const { ox: ewX, oy: ewY } = frameOrigin(2);
  drawStairLines(canvas, ewX, ewY, "vertical");

  for (let mask4 = 0; mask4 <= 15; mask4++) {
    const { ox, oy } = frameOrigin(3 + mask4);
    drawWallVariant(canvas, ox, oy, mask4);
  }

  const { ox: doorX, oy: doorY } = frameOrigin(3 + 16);
  drawDoor(canvas, doorX, doorY);

  canvas.writeFile(outPath);
  console.log(`debug tileset written to ${outPath} (${canvas.width}x${canvas.height}, ${FRAME_COUNT} frames)`);
}

run();
