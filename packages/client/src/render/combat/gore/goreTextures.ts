/** Cached liquid (smooth rounded canvas) and solid (crisp pixel-art mask) gore textures. */
import { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas } from "../../textures/pixelCanvas.js";
import {
  BONE_PILE_MASK, CHUNK_MASKS, RUBBLE_PILE_MASK, SPARK_MASK,
} from "./goreArtMasks.js";
import { buildSmoothLiquidGoreTextures } from "./goreLiquidShapes.js";

export type ChunkKind = "soft" | "bone" | "stone" | "straw";

export interface GoreTextureSet {
  readonly splatters: readonly Texture[];
  readonly arcs: readonly Texture[];
  readonly streaks: readonly Texture[];
  readonly goopBlobs: readonly Texture[];
  readonly goopPuddles: readonly Texture[];
  readonly pools: readonly Texture[];
  readonly chunks: Readonly<Record<ChunkKind, readonly Texture[]>>;
  readonly bonePile: Texture;
  readonly rubblePile: Texture;
  readonly footprints: readonly Texture[];
  readonly waterPlumes: readonly Texture[];
  readonly droplet: Texture;
  readonly spark: Texture;
}

const SHADE_BY_GLYPH: Readonly<Record<string, string>> = {
  "#": "#7c7c7c",
  "+": "#b2b2b2",
  o: "#dedede",
  "*": "#ffffff",
  1: "rgba(255,255,255,0.22)",
  2: "rgba(255,255,255,0.48)",
  3: "rgba(255,255,255,0.76)",
};

function maskToTexture(rows: readonly string[]): Texture {
  if (typeof document === "undefined") return Texture.WHITE;
  const h = rows.length;
  const w = rows[0]?.length ?? 1;
  const { canvas, ctx } = createPixelCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const shade = SHADE_BY_GLYPH[row[x]!];
      if (!shade) continue;
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvasToNearestTexture(canvas);
}

let cachedSet: GoreTextureSet | null = null;

export function getGoreTextures(): GoreTextureSet {
  if (cachedSet) return cachedSet;
  const smooth = buildSmoothLiquidGoreTextures();
  cachedSet = {
    splatters: smooth.splatters,
    arcs: smooth.arcs,
    streaks: smooth.streaks,
    goopBlobs: smooth.goopBlobs,
    goopPuddles: smooth.goopPuddles,
    pools: smooth.pools,
    chunks: {
      soft: CHUNK_MASKS.soft.map(maskToTexture),
      bone: CHUNK_MASKS.bone.map(maskToTexture),
      stone: CHUNK_MASKS.stone.map(maskToTexture),
      straw: CHUNK_MASKS.straw.map(maskToTexture),
    },
    bonePile: maskToTexture(BONE_PILE_MASK),
    rubblePile: maskToTexture(RUBBLE_PILE_MASK),
    footprints: smooth.footprints,
    waterPlumes: smooth.waterPlumes,
    droplet: smooth.droplet,
    spark: maskToTexture(SPARK_MASK),
  };
  return cachedSet;
}