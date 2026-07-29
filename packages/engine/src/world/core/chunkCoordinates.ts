import { CHUNK_SIZE, type Chunk } from "./types.js";

export interface ChunkCell {
  readonly cx: number;
  readonly cy: number;
  readonly index: number;
}

export function chunkCellAt(wx: number, wy: number): ChunkCell {
  const cx = Math.floor(wx / CHUNK_SIZE);
  const cy = Math.floor(wy / CHUNK_SIZE);
  const lx = wx - cx * CHUNK_SIZE;
  const ly = wy - cy * CHUNK_SIZE;
  return { cx, cy, index: ly * CHUNK_SIZE + lx };
}

export function generatedChunkCount(
  columns: ReadonlyMap<number, ReadonlyMap<number, Chunk>>,
): number {
  let total = 0;
  for (const row of columns.values()) total += row.size;
  return total;
}

export interface ChunkCacheRetention {
  readonly centerCx: number;
  readonly centerCy: number;
  readonly capacity: number;
}

/** Drops the farthest deterministic chunks until the requested cache cap is met. */
export function pruneGeneratedChunks(
  columns: Map<number, Map<number, Chunk>>,
  retention: ChunkCacheRetention,
): void {
  const overflow = generatedChunkCount(columns) - retention.capacity;
  if (overflow <= 0) return;
  const coordinates = generatedChunkCoordinates(columns);
  coordinates.sort((a, b) => distanceSquared(b, retention) - distanceSquared(a, retention));
  for (const { cx, cy } of coordinates.slice(0, overflow)) {
    const column = columns.get(cx);
    column?.delete(cy);
    if (column?.size === 0) columns.delete(cx);
  }
}

function generatedChunkCoordinates(
  columns: ReadonlyMap<number, ReadonlyMap<number, Chunk>>,
): Array<{ readonly cx: number; readonly cy: number }> {
  const coordinates = [];
  for (const [cx, column] of columns) {
    for (const cy of column.keys()) coordinates.push({ cx, cy });
  }
  return coordinates;
}

function distanceSquared(
  coordinate: { readonly cx: number; readonly cy: number },
  center: Pick<ChunkCacheRetention, "centerCx" | "centerCy">,
): number {
  return (coordinate.cx - center.centerCx) ** 2 +
    (coordinate.cy - center.centerCy) ** 2;
}
