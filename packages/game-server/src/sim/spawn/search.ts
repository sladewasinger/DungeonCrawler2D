import type { SimState } from "../state.js";

export function findWalkableNear({ sim, x, y, maxRadius = 6, avoid }: {
  sim: Pick<SimState, "world">;
  x: number;
  y: number;
  maxRadius?: number;
  avoid?: ReadonlySet<string>;
}): { x: number; y: number } | null {
  for (const tile of searchTiles(x, y, maxRadius)) if (isAvailableTile(sim, tile, avoid)) return tile;
  return null;
}

function searchTiles(x: number, y: number, maxRadius: number): Array<{ x: number; y: number }> {
  const tiles: Array<{ x: number; y: number }> = [];
  const center = { x: Math.round(x), y: Math.round(y) };
  for (let radius = 0; radius < maxRadius; radius++) addRing(tiles, center, radius);
  return tiles;
}

function addRing(tiles: Array<{ x: number; y: number }>, center: { x: number; y: number }, radius: number): void {
  if (radius === 0) return void tiles.push(center);
  for (let delta = -radius; delta <= radius; delta++) {
    tiles.push({ x: center.x + delta, y: center.y - radius }, { x: center.x + delta, y: center.y + radius });
    tiles.push({ x: center.x - radius, y: center.y + delta }, { x: center.x + radius, y: center.y + delta });
  }
}

function isAvailableTile(sim: Pick<SimState, "world">, tile: { x: number; y: number }, avoid?: ReadonlySet<string>): boolean {
  return !avoid?.has(`${tile.x},${tile.y}`) && sim.world.isWalkable(tile.x, tile.y);
}
