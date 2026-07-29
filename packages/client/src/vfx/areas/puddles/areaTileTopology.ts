import type { AreaSpriteKind } from "../areaEffectPool.js";
import { sameAreaSurfaceHeight } from "../presentation/areaSurface.js";

export const AREA_NEIGHBOR = {
  north: 1,
  east: 2,
  south: 4,
  west: 8,
} as const;

export interface AreaTileSource {
  readonly areaTiles: ReadonlyMap<string, string>;
  readonly areaLayers?: ReadonlyMap<string, readonly string[]> | undefined;
  readonly spriteByAreaId: ReadonlyMap<string, AreaSpriteKind>;
  readonly x: number;
  readonly y: number;
  readonly sprite: AreaSpriteKind;
  readonly groundHeight: number;
  readonly groundAt: (x: number, y: number) => number;
}

const CARDINAL_NEIGHBORS = [
  { dx: 0, dy: -1, bit: AREA_NEIGHBOR.north },
  { dx: 1, dy: 0, bit: AREA_NEIGHBOR.east },
  { dx: 0, dy: 1, bit: AREA_NEIGHBOR.south },
  { dx: -1, dy: 0, bit: AREA_NEIGHBOR.west },
] as const;

export function connectedAreaNeighborMask(source: AreaTileSource): number {
  let mask = 0;
  for (const neighbor of CARDINAL_NEIGHBORS) {
    const x = source.x + neighbor.dx;
    const y = source.y + neighbor.dy;
    const key = `${x},${y}`;
    if (cellHasSprite(source, key) && sameAreaSurfaceHeight(
      source.groundHeight,
      source.groundAt(x + 0.5, y + 0.5),
    )) mask |= neighbor.bit;
  }
  return mask;
}

function cellHasSprite(source: AreaTileSource, key: string): boolean {
  const layers = source.areaLayers?.get(key);
  if (layers) {
    return layers.some((id) => source.spriteByAreaId.get(id) === source.sprite);
  }
  const id = source.areaTiles.get(key);
  return Boolean(id && source.spriteByAreaId.get(id) === source.sprite);
}
