import type Phaser from "phaser";
import { ASSET_KEYS } from "../../../boot/assetManifest.js";
import { TERRAIN_ATLAS_COLUMNS, TERRAIN_ATLAS_ROWS_PER_SET } from "../planning/tileset.js";

const TILE_PX = 16;
const NEAREST_FILTER = 1 as Phaser.Textures.FilterMode;

interface GroundPalette {
  readonly base: string;
  readonly alt: string;
  readonly shadow: string;
  readonly accent: string;
  readonly highlight?: string;
}

interface CliffPalette {
  readonly lipTop: string;
  readonly lipBottom: string;
  readonly fill: string;
}

const DIRT_BROWN = "#5c402c";

const LUSH_GRASS: GroundPalette = { base: "#439149", alt: "#47984d", shadow: "#3d8643", accent: "#4ca052" };
const SUNLIT_GRASS: GroundPalette = { base: "#47994c", alt: "#4ca052", shadow: "#418f47", accent: "#52a858" };
const WARM_SAND: GroundPalette = { base: "#d5b06f", alt: "#c79e5b", shadow: "#b08749", accent: "#e2c385", highlight: "#efe0b3" };
const MOSSY_ROCK: GroundPalette = { base: "#272d33", alt: "#323942", shadow: "#1b2025", accent: "#2d5836" };

const SOLID_DIRT_CLIFF: CliffPalette = { lipTop: DIRT_BROWN, lipBottom: DIRT_BROWN, fill: DIRT_BROWN };
const TOP_DIRT_CLIFF: CliffPalette = { lipTop: "#442d1d", lipBottom: "#6f4e36", fill: DIRT_BROWN };
const SAND_CLIFF: CliffPalette = { lipTop: "#7f5d33", lipBottom: "#a87e47", fill: "#946d3d" };
const DARK_CLIFF: CliffPalette = { lipTop: "#1f242a", lipBottom: "#282e35", fill: "#1d2228" };

export function installForestTerrainAtlas(textures: Phaser.Textures.TextureManager): void {
  if (textures.exists(ASSET_KEYS.sharedAtlas)) textures.remove(ASSET_KEYS.sharedAtlas);
  const texture = textures.createCanvas(ASSET_KEYS.sharedAtlas, TERRAIN_ATLAS_COLUMNS * TILE_PX, TERRAIN_ATLAS_ROWS_PER_SET * TILE_PX);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, texture.width, texture.height);
  paintGroundTiles(ctx);
  paintCliffTiles(ctx);
  paintFeatureTiles(ctx);
  texture.refresh();
  texture.setFilter(NEAREST_FILTER);
}

function paintGroundTiles(ctx: CanvasRenderingContext2D): void {
  paintSmoothGrassTile({ ctx, col: 1, row: 0, palette: LUSH_GRASS, seed: 11 });
  paintSmoothGrassTile({ ctx, col: 2, row: 0, palette: SUNLIT_GRASS, seed: 23 });
  paintSmoothGrassTile({ ctx, col: 3, row: 0, palette: LUSH_GRASS, seed: 37 });
  paintSmoothGrassTile({ ctx, col: 4, row: 0, palette: SUNLIT_GRASS, seed: 53 });
  paintSandTile({ ctx, col: 5, row: 0, palette: WARM_SAND });
  paintSpeckledTile({ ctx, col: 6, row: 0, palette: MOSSY_ROCK, seed: 71 });
}

function paintCliffTiles(ctx: CanvasRenderingContext2D): void {
  paintCliffTile({ ctx, col: 1, row: 1, palette: SOLID_DIRT_CLIFF });
  paintCliffTile({ ctx, col: 3, row: 1, palette: TOP_DIRT_CLIFF });
  paintCliffTile({ ctx, col: 4, row: 1, palette: TOP_DIRT_CLIFF });
  paintCliffTile({ ctx, col: 5, row: 1, palette: SAND_CLIFF });
  paintCliffTile({ ctx, col: 2, row: 4, palette: DARK_CLIFF });
}

function paintFeatureTiles(ctx: CanvasRenderingContext2D): void {
  paintStairTile(ctx, 1, 2);
  paintCliffTile({ ctx, col: 2, row: 2, palette: SAND_CLIFF });
  paintDoorTile(ctx, 1, 3);
  paintBrazierTile(ctx, 2, 3);
  fillTileRect({ ctx, col: 1, row: 4, x: 0, y: 0, w: TILE_PX, h: TILE_PX, color: "#0c0f15" });
}

function paintSmoothGrassTile(input: { readonly ctx: CanvasRenderingContext2D; readonly col: number; readonly row: number; readonly palette: GroundPalette; readonly seed: number }): void {
  fillTileRect({ ctx: input.ctx, col: input.col, row: input.row, x: 0, y: 0, w: TILE_PX, h: TILE_PX, color: input.palette.base });
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const color = pickSmoothGrassPixel(input.palette, tileNoise(input.seed, x, y));
      if (color) plotTilePixel({ ctx: input.ctx, col: input.col, row: input.row, x, y, color });
    }
  }
}

function pickSmoothGrassPixel(palette: GroundPalette, roll: number): string | null {
  if (roll < 5) return palette.shadow;
  if (roll < 15) return palette.alt;
  if (roll < 19) return palette.accent;
  return null;
}

function paintSpeckledTile(input: { readonly ctx: CanvasRenderingContext2D; readonly col: number; readonly row: number; readonly palette: GroundPalette; readonly seed: number }): void {
  fillTileRect({ ctx: input.ctx, col: input.col, row: input.row, x: 0, y: 0, w: TILE_PX, h: TILE_PX, color: input.palette.base });
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const color = pickGroundPixel(input.palette, tileNoise(input.seed, x, y));
      if (color) plotTilePixel({ ctx: input.ctx, col: input.col, row: input.row, x, y, color });
    }
  }
}

function pickGroundPixel(palette: GroundPalette, roll: number): string | null {
  if (roll < 18) return palette.shadow;
  if (roll < 42) return palette.alt;
  if (roll < 54) return palette.accent;
  if (palette.highlight && roll === 97) return palette.highlight;
  return null;
}

function paintSandTile(input: { readonly ctx: CanvasRenderingContext2D; readonly col: number; readonly row: number; readonly palette: GroundPalette }): void {
  fillTileRect({ ctx: input.ctx, col: input.col, row: input.row, x: 0, y: 0, w: TILE_PX, h: TILE_PX, color: input.palette.base });
  for (let y = 0; y < TILE_PX; y++) paintSandRow(input, y);
}

function paintSandRow(input: { readonly ctx: CanvasRenderingContext2D; readonly col: number; readonly row: number; readonly palette: GroundPalette }, y: number): void {
  for (let x = 0; x < TILE_PX; x++) {
    const wave = (x + y * 2) % 8 === 0;
    const color = wave ? input.palette.accent : pickGroundPixel(input.palette, tileNoise(67, x, y));
    if (color) plotTilePixel({ ctx: input.ctx, col: input.col, row: input.row, x, y, color });
  }
}

function paintCliffTile(input: { readonly ctx: CanvasRenderingContext2D; readonly col: number; readonly row: number; readonly palette: CliffPalette }): void {
  const { ctx, col, row, palette } = input;
  fillTileRect({ ctx, col, row, x: 0, y: 0, w: TILE_PX, h: TILE_PX, color: palette.fill });
  fillTileRect({ ctx, col, row, x: 0, y: 0, w: TILE_PX, h: 2, color: palette.lipTop });
  fillTileRect({ ctx, col, row, x: 0, y: 2, w: TILE_PX, h: 2, color: palette.lipBottom });
}

function paintStairTile(ctx: CanvasRenderingContext2D, col: number, row: number): void {
  fillTileRect({ ctx, col, row, x: 0, y: 0, w: TILE_PX, h: TILE_PX, color: LUSH_GRASS.base });
  for (let step = 0; step < 4; step++) {
    fillTileRect({ ctx, col, row, x: 2, y: step * 4, w: 12, h: 3, color: "#9b6b43" });
    fillTileRect({ ctx, col, row, x: 2, y: step * 4 + 3, w: 12, h: 1, color: "#4d311c" });
  }
}

function paintDoorTile(ctx: CanvasRenderingContext2D, col: number, row: number): void {
  fillTileRect({ ctx, col, row, x: 0, y: 0, w: TILE_PX, h: TILE_PX, color: "#3d424b" });
  fillTileRect({ ctx, col, row, x: 3, y: 2, w: 10, h: 14, color: "#6e472b" });
  fillTileRect({ ctx, col, row, x: 4, y: 3, w: 8, h: 13, color: "#151821" });
}

function paintBrazierTile(ctx: CanvasRenderingContext2D, col: number, row: number): void {
  fillTileRect({ ctx, col, row, x: 0, y: 0, w: TILE_PX, h: TILE_PX, color: "#3d424b" });
  fillTileRect({ ctx, col, row, x: 5, y: 6, w: 6, h: 6, color: "#ff9b38" });
  fillTileRect({ ctx, col, row, x: 6, y: 7, w: 4, h: 3, color: "#ffe178" });
}

function fillTileRect(rect: { readonly ctx: CanvasRenderingContext2D; readonly col: number; readonly row: number; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly color: string }): void {
  rect.ctx.fillStyle = rect.color;
  rect.ctx.fillRect(rect.col * TILE_PX + rect.x, rect.row * TILE_PX + rect.y, rect.w, rect.h);
}

function plotTilePixel(pt: { readonly ctx: CanvasRenderingContext2D; readonly col: number; readonly row: number; readonly x: number; readonly y: number; readonly color: string }): void {
  pt.ctx.fillStyle = pt.color;
  pt.ctx.fillRect(pt.col * TILE_PX + pt.x, pt.row * TILE_PX + pt.y, 1, 1);
}

function tileNoise(seed: number, x: number, y: number): number {
  const mixed = Math.imul(seed ^ Math.imul(x + 1, 374761393), 668265263) ^ Math.imul(y + 1, 2246822519);
  return ((mixed ^ (mixed >>> 13)) >>> 0) % 100;
}
