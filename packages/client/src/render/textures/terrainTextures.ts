/** Multi-variant pixel-art terrain tile painters with rock cliff strata and organic detail. */
import { GroundKind, TILE_PX } from "@dc2d/engine";
import { createPixelCanvas, seededPixelNoise } from "./pixelCanvas.js";

export interface TerrainTileAtlas {
  readonly variants: ReadonlyMap<GroundKind, readonly HTMLCanvasElement[]>;
  readonly cliffFace: HTMLCanvasElement;
  readonly stairFace: HTMLCanvasElement;
}

interface TilePalette {
  readonly base: string;
  readonly mid: string;
  readonly dark: string;
  readonly highlight: string;
  readonly accent?: string;
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

function paintTerrainTile(kind: GroundKind, variant: number): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TILE_PX, TILE_PX);
  const palette = GROUND_PALETTES[kind];
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  scatterTileTexture(ctx, { kind, variant, palette });
  if (kind === GroundKind.Grass || kind === GroundKind.MeadowGrass || kind === GroundKind.ForestFloor) {
    paintGrassTufts(ctx, variant, palette);
  }
  return canvas;
}

function pickScatterColor(r: number, palette: TilePalette): string | null {
  if (r < 0.24) return palette.mid;
  if (r > 0.965 && palette.accent) return palette.accent;
  if (r > 0.87) return palette.dark;
  if (r > 0.74 && r < 0.81) return palette.highlight;
  return null;
}

function scatterTileTexture(
  ctx: CanvasRenderingContext2D,
  input: { readonly kind: GroundKind; readonly variant: number; readonly palette: TilePalette },
): void {
  const seed = Number(input.kind) * 193 + input.variant * 41;
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const color = pickScatterColor(seededPixelNoise(seed, x, y), input.palette);
      if (color) fillPx(ctx, { x, y, color });
    }
  }
}

function paintGrassTufts(ctx: CanvasRenderingContext2D, variant: number, palette: TilePalette): void {
  const count = 2 + (variant % 3);
  for (let i = 0; i < count; i++) {
    const bx = 2 + Math.floor(seededPixelNoise(901 + variant, i, 1) * 11);
    const by = 3 + Math.floor(seededPixelNoise(907 + variant, i, 2) * 10);
    fillPx(ctx, { x: bx, y: by, color: palette.dark });
    fillPx(ctx, { x: bx, y: by - 1, color: palette.highlight });
    fillPx(ctx, { x: bx + 1, y: by - 1, color: palette.highlight });
  }
}

function fillPx(ctx: CanvasRenderingContext2D, px: { readonly x: number; readonly y: number; readonly color: string }): void {
  ctx.fillStyle = px.color;
  ctx.fillRect(px.x, px.y, 1, 1);
}

function paintCliffFaceTile(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = "#524c58";
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = "#6b6370";
  ctx.fillRect(0, 2, TILE_PX, 5);
  ctx.fillStyle = "#3c3742";
  ctx.fillRect(0, 9, TILE_PX, 7);
  ctx.fillStyle = "#3f7d3a";
  ctx.fillRect(0, 0, TILE_PX, 2);
  ctx.fillStyle = "#26212c";
  ctx.fillRect(0, TILE_PX - 1, TILE_PX, 1);
  for (let x = 1; x < TILE_PX; x += 5) {
    fillPx(ctx, { x, y: 5, color: "#3c3742" });
    fillPx(ctx, { x: (x + 2) % TILE_PX, y: 11, color: "#6b6370" });
  }
  return canvas;
}

function paintStairFaceTile(): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = "#6c7382";
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  for (let step = 0; step < 4; step++) {
    const y = step * 4;
    ctx.fillStyle = "#9da6b5";
    ctx.fillRect(1, y, TILE_PX - 2, 2);
    ctx.fillStyle = "#484e5c";
    ctx.fillRect(1, y + 2, TILE_PX - 2, 2);
  }
  ctx.fillStyle = "#2b303a";
  ctx.fillRect(0, 0, 1, TILE_PX);
  ctx.fillRect(TILE_PX - 1, 0, 1, TILE_PX);
  return canvas;
}

export function createTerrainTileAtlas(): TerrainTileAtlas {
  const kinds: readonly GroundKind[] = [
    GroundKind.DeepWater, GroundKind.ShallowWater, GroundKind.Sand, GroundKind.Grass,
    GroundKind.MeadowGrass, GroundKind.ForestFloor, GroundKind.DirtPath, GroundKind.CliffStone, GroundKind.MossStone,
  ];
  const variants = new Map<GroundKind, readonly HTMLCanvasElement[]>();
  for (const kind of kinds) {
    variants.set(kind, [0, 1, 2, 3].map((v) => paintTerrainTile(kind, v)));
  }
  return { variants, cliffFace: paintCliffFaceTile(), stairFace: paintStairFaceTile() };
}
