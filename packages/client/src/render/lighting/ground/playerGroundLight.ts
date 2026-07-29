import {
  smoothstep01,
  TERRAIN,
  type TerrainType,
} from "@dc2d/engine";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { LIGHT_CURVE_FULL_LEVEL } from "../../terrain/shading/tileLight.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";
import {
  canGroundLightCrossStep,
  hasClearGroundLightLine,
  isGroundLightSurface,
  type GroundLightTerrain,
  type GroundLightTile,
} from "./groundLightVisibility.js";

const GROUND_LIGHT = LIGHTING_VISUAL_STYLE.ground;

export const PLAYER_GROUND_LIGHT_RADIUS = GROUND_LIGHT.radiusTiles;
/** Conservative disk bound for a tile-centered circle at any player sub-tile position. */
export const PLAYER_GROUND_LIGHT_MAX_CELLS =
  Math.ceil(Math.PI * (PLAYER_GROUND_LIGHT_RADIUS + 0.5) ** 2);
export const PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS =
  GROUND_LIGHT.updateIntervalMs;
export const PLAYER_GROUND_LIGHT_FADE_MS = GROUND_LIGHT.fadeMs;

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

export interface PlayerGroundLightWorld extends GroundLightTerrain {
  terrainAt(wx: number, wy: number): TerrainType;
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

function isLitGround(world: PlayerGroundLightWorld, tileX: number, tileY: number): boolean {
  return world.terrainAt(tileX, tileY) === TERRAIN.Floor;
}

interface GroundCellCandidate extends GroundLightTile { readonly distance: number; }

function addLitGroundCell(
  world: PlayerGroundLightWorld,
  cells: PlayerGroundLightCell[],
  candidate: GroundCellCandidate,
): void {
  if (!isLitGround(world, candidate.x, candidate.y)) return;
  cells.push({ tileX: candidate.x, tileY: candidate.y, strength: playerGroundLightStrength(candidate.distance), groundHeight: world.groundAt(candidate.x + 0.5, candidate.y + 0.5) });
}

interface PlayerGroundLightSearch { readonly world: PlayerGroundLightWorld; readonly origin: GroundLightTile; readonly player: Readonly<{ x: number; y: number }>; readonly cells: PlayerGroundLightCell[]; readonly visited: Set<string>; readonly queue: GroundLightTile[]; }

function createSearch(world: PlayerGroundLightWorld, playerX: number, playerY: number): PlayerGroundLightSearch {
  const origin = { x: Math.floor(playerX), y: Math.floor(playerY) };
  return { world, origin, player: { x: playerX, y: playerY }, cells: [], visited: new Set([tileKey(origin)]), queue: [origin] };
}

function tileKey(tile: GroundLightTile): string {
  return `${tile.x},${tile.y}`;
}

function distanceToPlayer(search: PlayerGroundLightSearch, tile: GroundLightTile): number {
  return Math.hypot(tile.x + 0.5 - search.player.x, tile.y + 0.5 - search.player.y);
}

function visitNeighbors(search: PlayerGroundLightSearch, tile: GroundLightTile): void {
  for (const [dx, dy] of ORTHOGONAL) {
    const next = { x: tile.x + dx, y: tile.y + dy };
    if (canQueueTile(search, tile, next)) search.queue.push(next);
  }
}

function canQueueTile(
  search: PlayerGroundLightSearch,
  from: GroundLightTile,
  tile: GroundLightTile,
): boolean {
  if (search.visited.has(tileKey(tile))) return false;
  search.visited.add(tileKey(tile));
  return distanceToPlayer(search, tile) <= PLAYER_GROUND_LIGHT_RADIUS + 1e-6
    && canGroundLightCrossStep(search.world, from, tile)
    && hasClearGroundLightLine(search.world, search.origin, tile);
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
  if (!isGroundLightSurface(world, search.origin)) return [];
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
