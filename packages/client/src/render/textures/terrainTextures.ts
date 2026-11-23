/** 32x32 pixel-art terrain tiles and extruded 136x306 GPU tileset atlas (nearest + 1px gutter). */
import { GroundKind } from "@dc2d/engine";
import { Texture } from "pixi.js";
import { createPixelCanvas, seededPixelNoise } from "./pixelCanvas.js";
import {
  TERRAIN_TEX_PX,
  paintCliffFaceTile32,
  paintOrganicDetails,
  paintStairFaceTile32,
  type TilePalette,
} from "./terrainTileDetails.js";

export { TERRAIN_TEX_PX } from "./terrainTileDetails.js";

export const TERRAIN_ATLAS_PAD = 1;
export const TERRAIN_ATLAS_STRIDE = TERRAIN_TEX_PX + TERRAIN_ATLAS_PAD * 2;
export const TERRAIN_ATLAS_COLS = 4;
export const TERRAIN_ATLAS_ROWS = 9;

export interface TerrainTileAtlas {
  readonly variants: ReadonlyMap<GroundKind, readonly HTMLCanvasElement[]>;
  readonly gpuSheet: Texture;
  readonly cliffFace: HTMLCanvasElement;
  readonly stairFace: HTMLCanvasElement;
}

const GROUND_PALETTES: Readonly<Record<GroundKind, TilePalette>> = {
  [GroundKind.DeepWater]: { base: "#174870", mid: "#1b5888", dark: "#123858", highlight: "#2974a8" },
  [GroundKind.ShallowWater]: { base: "#2a7da6", mid: "#3594bd", dark: "#22658a", highlight: "#58b5d6" },
  [GroundKind.Sand]: { base: "#dcc088", mid: "#cfb177", dark: "#b6945d", highlight: "#ead4a4", accent: "#a88754" },
  [GroundKind.Grass]: { base: "#3e8b43", mid: "#367d3b", dark: "#2c6932", highlight: "#52a34f", accent: "#6bc25e" },
  [GroundKind.MeadowGrass]: { base: "#52a246", mid: "#47923d", dark: "#3a7b33", highlight: "#6dbe54", accent: "#f6df75" },
  [GroundKind.ForestFloor]: { base: "#2b6335", mid: "#24542d", dark: "#1c4324", highlight: "#3b7a42", accent: "#7c5838" },
  [GroundKind.DirtPath]: { base: "#9c7349", mid: "#8b633d", dark: "#735030", highlight: "#b5895b", accent: "#c7ad8a" },
  [GroundKind.CliffStone]: { base: "#6c7684", mid: "#5c6573", dark: "#49515e", highlight: "#8b96a6", accent: "#4e7c44" },
  [GroundKind.MossStone]: { base: "#5d7c54", mid: "#4e6d47", dark: "#3d5838", highlight: "#769a67", accent: "#8896a3" },
};

const GROUND_KINDS: readonly GroundKind[] = [
  GroundKind.DeepWater, GroundKind.ShallowWater, GroundKind.Sand, GroundKind.Grass,
  GroundKind.MeadowGrass, GroundKind.ForestFloor, GroundKind.DirtPath, GroundKind.CliffStone, GroundKind.MossStone,
];

function pickScatterColor(r: number, palette: TilePalette): string | null {
  if (r < 0.22) return palette.mid;
  if (r > 0.96 && palette.accent) return palette.accent;
  if (r > 0.86) return palette.dark;
  if (r > 0.72 && r < 0.8) return palette.highlight;
  return null;
}

function paintClusterCell(
  ctx: CanvasRenderingContext2D,
  cell: { readonly x: number; readonly y: number; readonly seed: number },
  palette: TilePalette,
): void {
  const color = pickScatterColor(seededPixelNoise(cell.seed, cell.x, cell.y), palette);
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(cell.x, cell.y, 2, (cell.x + cell.y) % 4 === 0 ? 2 : 1);
}

function scatterTileClusters(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly kind: GroundKind;
  readonly variant: number;
  readonly palette: TilePalette;
}): void {
  const { ctx, kind, variant, palette } = input;
  const seed = Number(kind) * 193 + variant * 41;
  for (let y = 0; y < TERRAIN_TEX_PX; y += 2) {
    for (let x = 0; x < TERRAIN_TEX_PX; x += 2) paintClusterCell(ctx, { x, y, seed }, palette);
  }
}

function paintTerrainTile32(kind: GroundKind, variant: number): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TERRAIN_TEX_PX, TERRAIN_TEX_PX);
  const palette = GROUND_PALETTES[kind];
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, TERRAIN_TEX_PX, TERRAIN_TEX_PX);
  scatterTileClusters({ ctx, kind, variant, palette });
  paintOrganicDetails({ ctx, kind, variant, palette });
  return canvas;
}

function extrudeSlotGutter(ctx: CanvasRenderingContext2D, tile: HTMLCanvasElement, pos: { readonly dx: number; readonly dy: number }): void {
  const { dx, dy } = pos;
  const inner = TERRAIN_TEX_PX;
  ctx.drawImage(tile, dx, dy);
  ctx.drawImage(tile, 0, 0, inner, 1, dx, dy - 1, inner, 1);
  ctx.drawImage(tile, 0, inner - 1, inner, 1, dx, dy + inner, inner, 1);
  ctx.drawImage(ctx.canvas, dx, dy - 1, 1, inner + 2, dx - 1, dy - 1, 1, inner + 2);
  ctx.drawImage(ctx.canvas, dx + inner - 1, dy - 1, 1, inner + 2, dx + inner, dy - 1, 1, inner + 2);
}

function buildExtrudedGpuSheet(variants: ReadonlyMap<GroundKind, readonly HTMLCanvasElement[]>): Texture {
  const sheetW = TERRAIN_ATLAS_COLS * TERRAIN_ATLAS_STRIDE;
  const sheetH = TERRAIN_ATLAS_ROWS * TERRAIN_ATLAS_STRIDE;
  const { canvas, ctx } = createPixelCanvas(sheetW, sheetH);
  for (const kind of GROUND_KINDS) {
    const bank = variants.get(kind) ?? [];
    for (let v = 0; v < TERRAIN_ATLAS_COLS; v++) {
      const tile = bank[v];
      if (!tile) continue;
      extrudeSlotGutter(ctx, tile, {
        dx: v * TERRAIN_ATLAS_STRIDE + TERRAIN_ATLAS_PAD,
        dy: Number(kind) * TERRAIN_ATLAS_STRIDE + TERRAIN_ATLAS_PAD,
      });
    }
  }
  const tex = Texture.from({ resource: canvas, scaleMode: "nearest" });
  tex.source.addressMode = "clamp-to-edge";
  tex.source.update();
  return tex;
}

export function createTerrainTileAtlas(): TerrainTileAtlas {
  const variants = new Map<GroundKind, readonly HTMLCanvasElement[]>();
  for (const kind of GROUND_KINDS) {
    variants.set(kind, [0, 1, 2, 3].map((v) => paintTerrainTile32(kind, v)));
  }
  return {
    variants,
    gpuSheet: buildExtrudedGpuSheet(variants),
    cliffFace: paintCliffFaceTile32(),
    stairFace: paintStairFaceTile32(),
  };
}
