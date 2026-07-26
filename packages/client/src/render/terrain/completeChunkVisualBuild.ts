import type { ChunkVisual, ChunkVisualBuilder } from "./chunkVisualTypes.js";

export class TerrainPageBudgetExhaustedError extends Error {
  constructor(cx: number, cy: number) {
    super(`terrain page budget exhausted while building chunk ${cx},${cy}`);
    this.name = "TerrainPageBudgetExhaustedError";
  }
}

export function completeChunkVisualBuild(builder: ChunkVisualBuilder): ChunkVisual {
  while (true) {
    const visual = builder.step();
    if (visual) return visual;
    if (!builder.pageBudgetBlocked) continue;
    builder.cancel();
    throw new TerrainPageBudgetExhaustedError(builder.cx, builder.cy);
  }
}
