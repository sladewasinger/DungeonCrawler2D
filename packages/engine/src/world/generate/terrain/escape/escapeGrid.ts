import { TILE } from "../../../core/types.js";

const CARDINAL_OFFSETS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

export function escapeTileIsBlocked(tile: number | undefined): boolean {
  return tile === TILE.Void || tile === TILE.Bedrock;
}

export function escapeCardinalNeighbors(
  index: number,
  size: number,
): number[] {
  const x = index % size;
  const y = Math.floor(index / size);
  return CARDINAL_OFFSETS.flatMap(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < size && ny < size
      ? [ny * size + nx]
      : [];
  });
}
