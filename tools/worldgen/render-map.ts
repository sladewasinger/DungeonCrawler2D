// CLI: renders an N x N-chunk region of a world-generator's output to PNG,
// for visually judging worldgen redesigns against docs/VISUAL_DIRECTION.md.
//
// Usage: npx tsx tools/worldgen/render-map.ts <seed> <floor> <chunksNxN> <outPng> [--variant name]
//
// Dev tool only: imports the engine's world source directly (relative import
// into packages/engine/src is acceptable here; nothing under packages/ may
// import this tool or reference/).

import { CHUNK_SIZE } from "../../packages/engine/src/world/types.js";
import { parseArgs } from "./args.js";
import { Canvas } from "./canvas.js";
import { ChunkCache } from "./chunk-cache.js";
import { tileColor } from "./colors.js";
import { loadGenerator } from "./generator.js";
import { drawChunkHairlines, drawLegend, drawStairGlyphs } from "./overlay.js";

const TILE_PX = 6;
const LEGEND_H = 44;
const MIN_WIDTH = 760;
const BACKGROUND = { r: 20, g: 20, b: 28 };

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const generate = await loadGenerator(args.variant);
  const cache = new ChunkCache(generate, args.worldSeed, args.floor);

  const span = args.chunks * CHUNK_SIZE;
  const mapPx = span * TILE_PX;
  const width = Math.max(mapPx, MIN_WIDTH);
  const canvas = new Canvas(width, mapPx + LEGEND_H, BACKGROUND);

  for (let wy = 0; wy < span; wy++) {
    for (let wx = 0; wx < span; wx++) {
      const tile = cache.tileAt(wx, wy);
      const height = cache.heightAt(wx, wy);
      const zone = cache.zoneAt(wx, wy);
      canvas.fillRect(wx * TILE_PX, wy * TILE_PX, TILE_PX, TILE_PX, tileColor(tile, height, zone));
    }
  }

  drawChunkHairlines(canvas, args.chunks, TILE_PX, mapPx);
  drawStairGlyphs(canvas, cache, args.chunks, TILE_PX);
  drawLegend(canvas, mapPx, width);

  canvas.write(args.outPng);
  console.log(
    `wrote ${args.outPng} (${width}x${mapPx + LEGEND_H}px, seed=${args.worldSeed} floor=${args.floor} chunks=${args.chunks}x${args.chunks}${args.variant ? ` variant=${args.variant}` : ""})`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
