import { STEP_UP, hash2DFloat } from "@dc2d/engine";
import type Phaser from "phaser";

/**
 * Procedural placeholder art — deterministic pixel-art-ish tiles and
 * sprites drawn straight to canvas, no binary assets. Per-tile
 * variation is seeded from world coordinates, so every client draws
 * the identical world and re-renders are stable. Swapped out wholesale
 * when the real 16×16 tileset lands (v0.9).
 */

export const TILE_PX = 16;

const VARIATION_SEED = 0x9a77;

function hsl(h: number, s: number, l: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(l)));
  return `hsl(${h}, ${Math.round(s)}%, ${clamped}%)`;
}

/** Height → base lightness; cliffs and terraces read as light bands. */
export function floorLightness(h: number): number {
  return Math.max(12, Math.min(58, 20 + h * 5));
}

export interface NeighborHeights {
  n: number;
  e: number;
  s: number;
  w: number;
}

/**
 * Brick floor. Also draws the cliff face when the tile to the north is
 * a big step up (the classic top-down illusion: the face of the higher
 * terrain is painted on the lower tile's top band), and rim highlights
 * along edges where THIS tile is the top of a drop.
 */
export function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  wx: number,
  wy: number,
  h: number,
  neighbors: NeighborHeights,
  hue = 262,
  sat = 14,
): void {
  const light = floorLightness(h);

  // Mortar base, then bricks: 4 courses of 8×3 bricks, alternate
  // courses offset half a brick.
  ctx.fillStyle = hsl(hue, sat, light - 8);
  ctx.fillRect(px, py, TILE_PX, TILE_PX);
  for (let course = 0; course < 4; course++) {
    const by = py + course * 4;
    const offset = course % 2 === 0 ? 0 : -4;
    for (let bi = 0; bi < 3; bi++) {
      const bx = px + offset + bi * 8;
      const x0 = Math.max(bx, px);
      const x1 = Math.min(bx + 7, px + TILE_PX);
      if (x1 <= x0) continue;
      const delta =
        (hash2DFloat(VARIATION_SEED, wx * 4 + bi * 131 + course * 31, wy * 4 + course) - 0.5) * 8;
      ctx.fillStyle = hsl(hue, sat, light + delta);
      ctx.fillRect(x0, by, x1 - x0, 3);
    }
  }

  // Cliff face rising behind this tile (north neighbor much higher).
  const rise = neighbors.n - h;
  if (rise > STEP_UP) {
    const facePx = Math.max(6, Math.min(TILE_PX - 2, Math.round(rise * 4)));
    for (let fy = 0; fy < facePx; fy++) {
      const strata = fy % 4 === 3 ? -9 : ((fy + 1) % 4) * 1.5;
      ctx.fillStyle = hsl(hue, sat + 6, light + 4 + strata - fy * 0.5);
      ctx.fillRect(px, py + fy, TILE_PX, 1);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(px, py + facePx, TILE_PX, 2);
  }

  // Rim highlights: this tile is a ledge over the neighbor below.
  ctx.fillStyle = hsl(hue, sat + 10, light + 22);
  if (h - neighbors.s > STEP_UP) ctx.fillRect(px, py + TILE_PX - 1, TILE_PX, 1);
  if (h - neighbors.e > STEP_UP) ctx.fillRect(px + TILE_PX - 1, py, 1, TILE_PX);
  if (h - neighbors.w > STEP_UP) ctx.fillRect(px, py, 1, TILE_PX);
}

/** Sanctuary floor: the same brickwork in unmistakable teal. */
export function drawSanctuaryTile(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  wx: number,
  wy: number,
  h: number,
  neighbors: NeighborHeights,
): void {
  drawFloorTile(ctx, px, py, wx, wy, h, neighbors, 165, 34);
}

/** Rock wall: dark mass with speckle; a lighter "face" band where it meets open floor to the south. */
export function drawWallTile(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  wx: number,
  wy: number,
  southIsOpen: boolean,
): void {
  ctx.fillStyle = hsl(258, 20, 9);
  ctx.fillRect(px, py, TILE_PX, TILE_PX);

  // Speckle: a few deterministic darker/lighter chips.
  for (let i = 0; i < 6; i++) {
    const rx = Math.floor(hash2DFloat(VARIATION_SEED + i, wx, wy) * (TILE_PX - 2));
    const ry = Math.floor(hash2DFloat(VARIATION_SEED + 40 + i, wx, wy) * (TILE_PX - 2));
    ctx.fillStyle = i % 2 === 0 ? hsl(258, 18, 14) : hsl(258, 24, 5);
    ctx.fillRect(px + rx, py + ry, 2, 2);
  }

  if (southIsOpen) {
    // Visible wall face: stone courses on the bottom band.
    const faceTop = py + TILE_PX - 6;
    ctx.fillStyle = hsl(258, 16, 17);
    ctx.fillRect(px, faceTop, TILE_PX, 6);
    ctx.fillStyle = hsl(258, 18, 12);
    ctx.fillRect(px, faceTop + 2, TILE_PX, 1);
    ctx.fillRect(px, faceTop + 5, TILE_PX, 1);
    const seam = 4 + Math.floor(hash2DFloat(VARIATION_SEED + 90, wx, wy) * 8);
    ctx.fillRect(px + seam, faceTop, 1, 2);
    ctx.fillRect(px + ((seam + 7) % TILE_PX), faceTop + 3, 1, 2);
  }
}

/** Stairway marker: bold purple treads. */
export function drawStairsTile(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
): void {
  for (let tread = 0; tread < 4; tread++) {
    ctx.fillStyle = hsl(275, 46, tread % 2 === 0 ? 40 : 28);
    ctx.fillRect(px, py + tread * 4, TILE_PX, 4);
  }
  ctx.fillStyle = hsl(275, 50, 55);
  ctx.fillRect(px, py, TILE_PX, 1);
}

// ── player sprite ──────────────────────────────────────────────────

/** 8×10 logical pixels, drawn at 2× → 16×20 texture. */
const PLAYER_PIXELS = [
  "..HHHH..",
  ".HHHHHH.",
  ".HFFFFH.",
  ".HFFFFH.",
  ".HHHHHH.",
  ".CCCCCC.",
  "CCCCCCCC",
  "CCCCCCCC",
  ".CCCCCC.",
  ".BB..BB.",
];

interface PlayerPalette {
  H: string; // hood
  C: string; // cloak
  F: string; // face
  B: string; // boots
}

const SELF_PALETTE: PlayerPalette = {
  H: "#e8b53e",
  C: "#bd8a26",
  F: "#f2d3a7",
  B: "#503c28",
};

const PEER_PALETTE: PlayerPalette = {
  H: "#59b7d8",
  C: "#3f89a8",
  F: "#f2d3a7",
  B: "#39394a",
};

export const PLAYER_TEXTURE_SELF = "player-self";
export const PLAYER_TEXTURE_PEER = "player-peer";

function drawPlayerTexture(
  scene: Phaser.Scene,
  key: string,
  palette: PlayerPalette,
): void {
  if (scene.textures.exists(key)) return;
  const scale = 2;
  const width = PLAYER_PIXELS[0]!.length * scale;
  const height = PLAYER_PIXELS.length * scale;
  const canvas = scene.textures.createCanvas(key, width, height)!;
  const ctx = canvas.getContext();
  for (let row = 0; row < PLAYER_PIXELS.length; row++) {
    const line = PLAYER_PIXELS[row]!;
    for (let col = 0; col < line.length; col++) {
      const cell = line[col] as keyof PlayerPalette | ".";
      if (cell === ".") continue;
      ctx.fillStyle = palette[cell];
      ctx.fillRect(col * scale, row * scale, scale, scale);
    }
  }
  canvas.refresh();
}

/** Create the self/peer sprite textures (idempotent). */
export function ensurePlayerTextures(scene: Phaser.Scene): void {
  drawPlayerTexture(scene, PLAYER_TEXTURE_SELF, SELF_PALETTE);
  drawPlayerTexture(scene, PLAYER_TEXTURE_PEER, PEER_PALETTE);
}
