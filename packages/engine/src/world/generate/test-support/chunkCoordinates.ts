export interface GeneratedChunkCoordinate {
  readonly worldSeed: number;
  readonly floor: number;
  readonly cx: number;
  readonly cy: number;
}

interface ChunkSearch {
  readonly worldSeed: number;
  readonly floor: number;
  readonly min: number;
  readonly max: number;
  readonly predicate: (chunk: GeneratedChunkCoordinate) => boolean;
}

export function chunkGrid(min: number, max: number): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  for (let cx = min; cx <= max; cx++) {
    for (let cy = min; cy <= max; cy++) coordinates.push([cx, cy]);
  }
  return coordinates;
}

export function findFirstChunk(search: ChunkSearch): { cx: number; cy: number } | null {
  for (let cx = search.min; cx <= search.max; cx++) {
    const found = findInColumn(search, cx);
    if (found) return found;
  }
  return null;
}

function findInColumn(
  search: ChunkSearch,
  cx: number,
): { cx: number; cy: number } | null {
  for (let cy = search.min; cy <= search.max; cy++) {
    if (search.predicate({
      worldSeed: search.worldSeed,
      floor: search.floor,
      cx,
      cy,
    })) return { cx, cy };
  }
  return null;
}
