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
import { paintSoftBlob } from "./terrainTileMotifs.js";

export { TERRAIN_TEX_PX } from "./terrainTileDetails.js";

export const TERRAIN_ATLAS_PAD = 1;
export const TERRAIN_ATLAS_STRIDE = TERRAIN_TEX_PX + TERRAIN_ATLAS_PAD * 2;
export const TERRAIN_ATLAS_COLS = 4;
export const TERRAIN_ATLAS_ROWS = 17;

export interface TerrainTileAtlas {
  readonly variants: ReadonlyMap<GroundKind, readonly HTMLCanvasElement[]>;
  readonly gpuSheet: Texture;
  readonly cliffFace: HTMLCanvasElement;
  readonly stairFace: HTMLCanvasElement;
}

const GROUND_PALETTES: Readonly<Record<GroundKind, TilePalette>> = {
  [GroundKind.DeepWater]: { base: "#205982", mid: "#1a4b70", dark: "#143b5c", highlight: "#357aa8" },
  [GroundKind.ShallowWater]: { base: "#3d96b8", mid: "#3385a8", dark: "#287094", highlight: "#78c7de" },
  [GroundKind.Sand]: { base: "#e3c992", mid: "#d3b780", dark: "#ba9b66", highlight: "#f0dbab", accent: "#f6ebd0" },
  [GroundKind.Grass]: { base: "#5c9948", mid: "#518b40", dark: "#437836", highlight: "#78b454", accent: "#8ec85e" },
  [GroundKind.MeadowGrass]: { base: "#6daa4b", mid: "#5f9a42", dark: "#4e8338", highlight: "#88c459", accent: "#f6e37a" },
  [GroundKind.ForestFloor]: { base: "#38693c", mid: "#2f5a34", dark: "#24472b", highlight: "#4b8048", accent: "#8b623f" },
  [GroundKind.DirtPath]: { base: "#b0865c", mid: "#9e744e", dark: "#7c583a", highlight: "#c79d70", accent: "#d8be98" },
  [GroundKind.CliffStone]: { base: "#7d838c", mid: "#6a7079", dark: "#4c515c", highlight: "#9ba2ac", accent: "#678b54" },
  [GroundKind.MossStone]: { base: "#6e7774", mid: "#5d6664", dark: "#434b4b", highlight: "#8c9690", accent: "#578b42" },
  [GroundKind.AutumnGrass]: { base: "#8c943e", mid: "#7c8434", dark: "#636928", highlight: "#aeb34c", accent: "#d9923b" },
  [GroundKind.AutumnFloor]: { base: "#8c4a27", mid: "#7a3e20", dark: "#5c2b16", highlight: "#b56936", accent: "#e2a246" },
  [GroundKind.BogMud]: { base: "#473b32", mid: "#3b3029", dark: "#2b221d", highlight: "#5c4d41", accent: "#506b48" },
  [GroundKind.BogMoss]: { base: "#376850", mid: "#2d5744", dark: "#214034", highlight: "#4c8a66", accent: "#58d6b8" },
  [GroundKind.SlateRock]: { base: "#57606b", mid: "#49515b", dark: "#343a42", highlight: "#76818f", accent: "#9aa5b4" },
  [GroundKind.AshGround]: { base: "#706b68", mid: "#605b58", dark: "#46423f", highlight: "#8b8580", accent: "#b88a4a" },
  [GroundKind.RuinFlagstone]: { base: "#474657", mid: "#3a3949", dark: "#272634", highlight: "#626078", accent: "#9f6af2" },
  [GroundKind.CursedMoss]: { base: "#3a2e54", mid: "#302547", dark: "#211933", highlight: "#544178", accent: "#c084fc" },
};

const GROUND_KINDS: readonly GroundKind[] = [
  GroundKind.DeepWater, GroundKind.ShallowWater, GroundKind.Sand, GroundKind.Grass,
  GroundKind.MeadowGrass, GroundKind.ForestFloor, GroundKind.DirtPath, GroundKind.CliffStone, GroundKind.MossStone,
  GroundKind.AutumnGrass, GroundKind.AutumnFloor, GroundKind.BogMud, GroundKind.BogMoss,
  GroundKind.SlateRock, GroundKind.AshGround, GroundKind.RuinFlagstone, GroundKind.CursedMoss,
];

function pickGrainColor(r: number, palette: TilePalette): string | null {
  if (r < 0.25) return palette.mid;
  if (r > 0.965 && palette.accent) return palette.accent;
  if (r > 0.87) return palette.dark;
  if (r > 0.74 && r < 0.82) return palette.highlight;
  return null;
}

function paintGrainCell(
  ctx: CanvasRenderingContext2D,
  cell: { readonly x: number; readonly y: number; readonly seed: number },
  palette: TilePalette,
): void {
  const color = pickGrainColor(seededPixelNoise(cell.seed, cell.x, cell.y), palette);
  if (!color) return;
  ctx.fillStyle = color;
  const tall = (cell.x + cell.y) % 4 === 0 ? 2 : 1;
  ctx.fillRect(cell.x, cell.y, 2, tall);
}

function scatterSurfaceGrain(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly kind: GroundKind;
  readonly variant: number;
  readonly palette: TilePalette;
}): void {
  const { ctx, kind, variant, palette } = input;
  const seed = Number(kind) * 193 + variant * 41;
  for (let y = 0; y < TERRAIN_TEX_PX; y += 2) {
    for (let x = 0; x < TERRAIN_TEX_PX; x += 2) paintGrainCell(ctx, { x, y, seed }, palette);
  }
}

const ROCKY_KINDS = new Set<GroundKind>([GroundKind.CliffStone, GroundKind.MossStone, GroundKind.SlateRock, GroundKind.RuinFlagstone]);

function paintSoftTonalPatches(input: {
  readonly ctx: CanvasRenderingContext2D;
  readonly kind: GroundKind;
  readonly variant: number;
  readonly palette: TilePalette;
}): void {
  const { ctx, kind, variant, palette } = input;
  const count = ROCKY_KINDS.has(kind) ? 3 : 6;
  const seed = Number(kind) * 233 + variant * 53;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(seededPixelNoise(seed, i, 1) * TERRAIN_TEX_PX);
    const y = Math.floor(seededPixelNoise(seed, i, 2) * TERRAIN_TEX_PX);
    const w = 4 + Math.floor(seededPixelNoise(seed, i, 3) * 4);
    const h = 3 + (i & 1);
    paintSoftBlob(ctx, { x, y }, { w, h, color: palette.mid });
  }
}

function paintTerrainTile32(kind: GroundKind, variant: number): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TERRAIN_TEX_PX, TERRAIN_TEX_PX);
  const palette = GROUND_PALETTES[kind];
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, TERRAIN_TEX_PX, TERRAIN_TEX_PX);
  paintSoftTonalPatches({ ctx, kind, variant, palette });
  scatterSurfaceGrain({ ctx, kind, variant, palette });
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
