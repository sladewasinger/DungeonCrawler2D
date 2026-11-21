import { TERRAIN, type TerrainType } from "@dc2d/engine";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

const GROUND_HEIGHT_EPSILON = 1e-6;

export interface GroundLightTerrain {
  terrainAt(wx: number, wy: number): TerrainType;
  groundAt(x: number, y: number): number;
  heightAt?(wx: number, wy: number): number;
  isWalkable?(wx: number, wy: number): boolean;
}

export interface GroundLightTile {
  readonly x: number;
  readonly y: number;
}

interface GridLine {
  x: number;
  y: number;
  readonly dx: number;
  readonly dy: number;
  readonly stepX: number;
  readonly stepY: number;
  error: number;
}

export function isGroundLightSurface(
  world: GroundLightTerrain,
  tile: GroundLightTile,
): boolean {
  return world.terrainAt(tile.x, tile.y) === TERRAIN.Floor &&
    (world.isWalkable?.(tile.x, tile.y) ?? true);
}

export function canGroundLightCrossStep(
  world: GroundLightTerrain,
  from: GroundLightTile,
  to: GroundLightTile,
): boolean {
  if (!isGroundLightSurface(world, to)) return false;
  const difference = Math.abs(
    groundHeightAt(world, from) - groundHeightAt(world, to),
  );
  return difference <=
    LIGHTING_VISUAL_STYLE.ground.maximumStepHeight + GROUND_HEIGHT_EPSILON;
}

/** Walls, cliffs, and voids cast a direct grid-space shadow. */
export function hasClearGroundLightLine(
  world: GroundLightTerrain,
  from: GroundLightTile,
  to: GroundLightTile,
): boolean {
  const line = createLine(from, to);
  while (!lineReached(line, to)) {
    const previous = { x: line.x, y: line.y };
    stepLine(line);
    if (!canGroundLightCrossStep(world, previous, line)) return false;
  }
  return true;
}

function groundHeightAt(
  world: GroundLightTerrain,
  tile: GroundLightTile,
): number {
  return world.heightAt?.(tile.x, tile.y) ?? world.groundAt(tile.x + 0.5, tile.y + 0.5);
}

function createLine(from: GroundLightTile, to: GroundLightTile): GridLine {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return {
    x: from.x,
    y: from.y,
    dx,
    dy,
    stepX: Math.sign(to.x - from.x),
    stepY: Math.sign(to.y - from.y),
    error: dx - dy,
  };
}

function lineReached(line: GridLine, target: GroundLightTile): boolean {
  return line.x === target.x && line.y === target.y;
}

function stepLine(line: GridLine): void {
  const doubledError = line.error * 2;
  if (doubledError > -line.dy) {
    line.error -= line.dy;
    line.x += line.stepX;
  }
  if (doubledError < line.dx) {
    line.error += line.dx;
    line.y += line.stepY;
  }
}
