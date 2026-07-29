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
