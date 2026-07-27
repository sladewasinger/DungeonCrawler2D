import type { GameSim } from "../../index.js";

export interface NearbyAreaSearch {
  sim: GameSim;
  x: number;
  y: number;
  tag: string;
}

interface TilePosition {
  x: number;
  y: number;
}

interface SpiralSearch {
  anchor: TilePosition;
  maxRadius: number;
  predicate: TilePredicate;
}

interface ArenaSearch {
  sim: GameSim;
  anchor: TilePosition;
  clearance?: number;
}

type TilePredicate = (x: number, y: number) => boolean;

export function nearbyAreaTile({ sim, x, y, tag }: NearbyAreaSearch): string | null {
  const found = squareTiles({ x: Math.floor(x), y: Math.floor(y) }, 2)
    .find((tile) => sim.areas.hasTagAt(tile.x, tile.y, tag));
  return found ? sim.areas.defAt(found.x, found.y) : null;
}

export function findFlatFloor(sim: GameSim, ax: number, ay: number): TilePosition {
  return centerTile(spiralFind({
    anchor: { x: ax, y: ay },
    maxRadius: 96,
    predicate: (x, y) => isFlatFloor(sim, x, y),
  }));
}

export function findFlatArena({ sim, anchor, clearance = 2 }: ArenaSearch): TilePosition {
  return centerTile(spiralFind({
    anchor,
    maxRadius: 64,
    predicate: (x, y) => isClearArena(sim, { x, y }, clearance),
  }));
}

function isFlatFloor(sim: GameSim, x: number, y: number): boolean {
  return sim.world.isWalkable(x, y) && sim.world.heightAt(x, y) === 0 && !sim.world.isSanctuary(x, y);
}

function centerTile(tile: TilePosition): TilePosition {
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

function spiralFind({ anchor, maxRadius, predicate }: SpiralSearch): TilePosition {
  const start = { x: Math.floor(anchor.x), y: Math.floor(anchor.y) };
  for (let radius = 0; radius < maxRadius; radius++) {
    const found = squareRing(start, radius).find((tile) => predicate(tile.x, tile.y));
    if (found) return found;
  }
  throw new Error(`no tile satisfying the predicate found near (${anchor.x}, ${anchor.y})`);
}

function squareRing(center: TilePosition, radius: number): TilePosition[] {
  if (radius === 0) return [center];
  return [
    ...horizontalEdge(center, radius, -radius),
    ...horizontalEdge(center, radius, radius),
    ...verticalEdges(center, radius),
  ];
}

function horizontalEdge(center: TilePosition, radius: number, offsetY: number): TilePosition[] {
  return Array.from({ length: radius * 2 + 1 }, (_, index) => ({
    x: center.x - radius + index,
    y: center.y + offsetY,
  }));
}

function verticalEdges(center: TilePosition, radius: number): TilePosition[] {
  return Array.from({ length: Math.max(0, radius * 2 - 1) }, (_, index) => {
    const y = center.y - radius + index + 1;
    return [{ x: center.x - radius, y }, { x: center.x + radius, y }];
  }).flat();
}

function isClearArena(sim: GameSim, center: TilePosition, clearance: number): boolean {
  return squareTiles(center, clearance).every((tile) => isFlatFloor(sim, tile.x, tile.y));
}

function squareTiles(center: TilePosition, radius: number): TilePosition[] {
  return Array.from({ length: radius * 2 + 1 }, (_, row) =>
    Array.from({ length: radius * 2 + 1 }, (_, column) => ({
      x: center.x - radius + column,
      y: center.y - radius + row,
    })),
  ).flat();
}
