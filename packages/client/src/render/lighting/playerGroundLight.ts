import { smoothstep01, SOLID_TILES, TILE, type TileType } from "@dc2d/engine";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { isVoidTile } from "../terrain/heightShade.js";
import { LIGHT_CURVE_FULL_LEVEL } from "../terrain/tileLight.js";

export const PLAYER_GROUND_LIGHT_RADIUS = 12;
/** Conservative disk bound for a tile-centered circle at any player sub-tile position. */
export const PLAYER_GROUND_LIGHT_MAX_CELLS =
  Math.ceil(Math.PI * (PLAYER_GROUND_LIGHT_RADIUS + 0.5) ** 2);
export const PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS = 100;
export const PLAYER_GROUND_LIGHT_FADE_MS = 180;

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

/** Matches terrain light's S-curve: a bright core, then a sharply fading tail. */
export function playerGroundLightStrength(distance: number): number {
  return smoothstep01((PLAYER_GROUND_LIGHT_RADIUS - distance) / LIGHT_CURVE_FULL_LEVEL);
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
  const tile = world.tileAt(tileX, tileY);
  return !SOLID_TILES.has(tile) && !isVoidTile(tile);
}

function isLitGround(world: PlayerGroundLightWorld, tileX: number, tileY: number): boolean {
  return world.tileAt(tileX, tileY) === TILE.Floor;
}

/** Walls and voids cast a direct grid-space shadow; light cannot route around
 * the end of a blocker and illuminate a tile behind its opaque face. */
function hasClearGroundLine(
  world: PlayerGroundLightWorld,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  let x = fromX;
  let y = fromY;
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  let error = dx - dy;
  while (x !== toX || y !== toY) {
    const doubledError = error * 2;
    if (doubledError > -dy) {
      error -= dy;
      x += stepX;
    }
    if (doubledError < dx) {
      error += dx;
      y += stepY;
    }
    if (!isPassableGround(world, x, y)) return false;
  }
  return true;
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
    strength: playerGroundLightStrength(distance),
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
  const queue: Array<readonly [number, number]> = [[originX, originY]];
  const distanceToPlayer = (tileX: number, tileY: number): number =>
    Math.hypot(tileX + 0.5 - playerX, tileY + 0.5 - playerY);
  const withinRadius = (tileX: number, tileY: number): boolean =>
    distanceToPlayer(tileX, tileY) <= PLAYER_GROUND_LIGHT_RADIUS + 1e-6;

  for (let head = 0; head < queue.length && cells.length < PLAYER_GROUND_LIGHT_MAX_CELLS; head++) {
    const [tileX, tileY] = queue[head] ?? [originX, originY];
    addLitGroundCell(world, cells, tileX, tileY, distanceToPlayer(tileX, tileY));

    for (const [dx, dy] of ORTHOGONAL) {
      const nextX = tileX + dx;
      const nextY = tileY + dy;
      const key = `${nextX},${nextY}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (!withinRadius(nextX, nextY)) continue;
      if (!isPassableGround(world, nextX, nextY)) continue;
      if (!hasClearGroundLine(world, originX, originY, nextX, nextY)) continue;
      queue.push([nextX, nextY]);
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
