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

interface TileCoordinate { readonly x: number; readonly y: number; }

interface GridLine { x: number; y: number; readonly dx: number; readonly dy: number; readonly stepX: number; readonly stepY: number; error: number; }

/** Walls and voids cast a direct grid-space shadow; light cannot route around
 * the end of a blocker and illuminate a tile behind its opaque face. */
function hasClearGroundLine(world: PlayerGroundLightWorld, from: TileCoordinate, to: TileCoordinate): boolean {
  const line = createLine(from, to);
  while (!lineReached(line, to)) {
    stepLine(line);
    if (!isPassableGround(world, line.x, line.y)) return false;
  }
  return true;
}

function createLine(from: TileCoordinate, to: TileCoordinate): GridLine {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return { x: from.x, y: from.y, dx, dy, stepX: Math.sign(to.x - from.x), stepY: Math.sign(to.y - from.y), error: dx - dy };
}

function lineReached(line: GridLine, target: TileCoordinate): boolean {
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

interface GroundCellCandidate extends TileCoordinate { readonly distance: number; }

function addLitGroundCell(
  world: PlayerGroundLightWorld,
  cells: PlayerGroundLightCell[],
  candidate: GroundCellCandidate,
): void {
  if (!isLitGround(world, candidate.x, candidate.y)) return;
  cells.push({ tileX: candidate.x, tileY: candidate.y, strength: playerGroundLightStrength(candidate.distance), groundHeight: world.groundAt(candidate.x + 0.5, candidate.y + 0.5) });
}

interface PlayerGroundLightSearch { readonly world: PlayerGroundLightWorld; readonly origin: TileCoordinate; readonly player: Readonly<{ x: number; y: number }>; readonly cells: PlayerGroundLightCell[]; readonly visited: Set<string>; readonly queue: TileCoordinate[]; }

function createSearch(world: PlayerGroundLightWorld, playerX: number, playerY: number): PlayerGroundLightSearch {
  const origin = { x: Math.floor(playerX), y: Math.floor(playerY) };
  return { world, origin, player: { x: playerX, y: playerY }, cells: [], visited: new Set([tileKey(origin)]), queue: [origin] };
}

function tileKey(tile: TileCoordinate): string {
  return `${tile.x},${tile.y}`;
}

function distanceToPlayer(search: PlayerGroundLightSearch, tile: TileCoordinate): number {
  return Math.hypot(tile.x + 0.5 - search.player.x, tile.y + 0.5 - search.player.y);
}

function visitNeighbors(search: PlayerGroundLightSearch, tile: TileCoordinate): void {
  for (const [dx, dy] of ORTHOGONAL) {
    const next = { x: tile.x + dx, y: tile.y + dy };
    if (canQueueTile(search, next)) search.queue.push(next);
  }
}

function canQueueTile(search: PlayerGroundLightSearch, tile: TileCoordinate): boolean {
  if (search.visited.has(tileKey(tile))) return false;
  search.visited.add(tileKey(tile));
  return distanceToPlayer(search, tile) <= PLAYER_GROUND_LIGHT_RADIUS + 1e-6
    && isPassableGround(search.world, tile.x, tile.y)
    && hasClearGroundLine(search.world, search.origin, tile);
}

function populateGroundLightCells(search: PlayerGroundLightSearch): void {
  for (let head = 0; head < search.queue.length && search.cells.length < PLAYER_GROUND_LIGHT_MAX_CELLS; head++) {
    const tile = search.queue[head];
    if (!tile) continue;
    addLitGroundCell(search.world, search.cells, { ...tile, distance: distanceToPlayer(search, tile) });
    visitNeighbors(search, tile);
  }
}

export function playerGroundLightCells(
  world: PlayerGroundLightWorld,
  playerX: number,
  playerY: number,
): readonly PlayerGroundLightCell[] {
  const search = createSearch(world, playerX, playerY);
  if (!isPassableGround(world, search.origin.x, search.origin.y)) return [];
  populateGroundLightCells(search);
  return search.cells;
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
