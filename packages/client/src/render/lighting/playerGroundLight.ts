import { SOLID_TILES, TILE, type TileType } from "@dc2d/engine";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { isChasmDepth } from "../terrain/heightShade.js";

export const PLAYER_GROUND_LIGHT_RADIUS = 4;
export const PLAYER_GROUND_LIGHT_MAX_CELLS = 41;
export const PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS = 100;
export const PLAYER_GROUND_LIGHT_FADE_MS = 180;
export const PLAYER_GROUND_LIGHT_STRENGTH_STEPS = [1, 0.8, 0.6, 0.4, 0.2] as const;

export const playerGroundLightEnabledForProfile = (
  profile: "constrained" | "desktop",
): boolean => profile === "desktop";

export function playerGroundLightFadeAlpha(
  startAlpha: number,
  targetAlpha: number,
  elapsedMs: number,
): number {
  const progress = Math.max(0, Math.min(1, elapsedMs / PLAYER_GROUND_LIGHT_FADE_MS));
  const eased = progress * progress * (3 - 2 * progress);
  return startAlpha + (targetAlpha - startAlpha) * eased;
}

export interface PlayerGroundLightWorld {
  tileAt(wx: number, wy: number): TileType;
  heightAt(wx: number, wy: number): number;
  groundAt(x: number, y: number): number;
}

export interface PlayerGroundLightCell {
  readonly tileX: number;
  readonly tileY: number;
  readonly strength: number;
  readonly groundHeight: number;
}

export interface PlayerGroundLightUpdate {
  readonly tileX: number;
  readonly tileY: number;
  readonly orientation: ViewOrientation;
  readonly atMs: number;
}

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function isPassableGround(world: PlayerGroundLightWorld, tileX: number, tileY: number): boolean {
  return !SOLID_TILES.has(world.tileAt(tileX, tileY)) &&
    !isChasmDepth(world.heightAt(tileX, tileY));
}

function isLitGround(world: PlayerGroundLightWorld, tileX: number, tileY: number): boolean {
  return world.tileAt(tileX, tileY) === TILE.Floor;
}

function addLitGroundCell(
  world: PlayerGroundLightWorld,
  cells: PlayerGroundLightCell[],
  tileX: number,
  tileY: number,
  distance: number,
): void {
  if (!isLitGround(world, tileX, tileY)) return;
  cells.push({
    tileX,
    tileY,
    strength: PLAYER_GROUND_LIGHT_STRENGTH_STEPS[distance] ?? 0,
    groundHeight: world.groundAt(tileX + 0.5, tileY + 0.5),
  });
}

export function playerGroundLightCells(
  world: PlayerGroundLightWorld,
  playerX: number,
  playerY: number,
): readonly PlayerGroundLightCell[] {
  const originX = Math.floor(playerX);
  const originY = Math.floor(playerY);
  if (!isPassableGround(world, originX, originY)) return [];

  const cells: PlayerGroundLightCell[] = [];
  const visited = new Set<string>([`${originX},${originY}`]);
  const queue: Array<readonly [number, number, number]> = [[originX, originY, 0]];

  for (let head = 0; head < queue.length && cells.length < PLAYER_GROUND_LIGHT_MAX_CELLS; head++) {
    const [tileX, tileY, distance] = queue[head] ?? [originX, originY, 0];
    addLitGroundCell(world, cells, tileX, tileY, distance);
    if (distance >= PLAYER_GROUND_LIGHT_RADIUS) continue;

    for (const [dx, dy] of ORTHOGONAL) {
      const nextX = tileX + dx;
      const nextY = tileY + dy;
      const key = `${nextX},${nextY}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (!isPassableGround(world, nextX, nextY)) continue;
      queue.push([nextX, nextY, distance + 1]);
    }
  }

  return cells;
}

export function shouldUpdatePlayerGroundLight(
  previous: PlayerGroundLightUpdate | null,
  next: PlayerGroundLightUpdate,
): boolean {
  if (previous === null) return true;
  if (previous.tileX !== next.tileX || previous.tileY !== next.tileY) return true;
  if (previous.orientation !== next.orientation) return true;
  return next.atMs - previous.atMs >= PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS;
}
