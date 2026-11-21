import {
  CHUNK_SIZE,
  isRoomIsolationChunk,
  ROOM_WALL_RISE,
  TERRAIN,
} from "@dc2d/engine";
import {
  PLAYER_GROUND_LIGHT_MAX_CELLS,
  PLAYER_GROUND_LIGHT_RADIUS,
  playerGroundLightStrength,
  type PlayerGroundLightCell,
  type PlayerGroundLightWorld,
} from "./playerGroundLight.js";

export function roomGroundLightCells(
  world: PlayerGroundLightWorld,
  playerX: number,
  playerY: number,
): readonly PlayerGroundLightCell[] {
  const cells: PlayerGroundLightCell[] = [];
  const radius = PLAYER_GROUND_LIGHT_RADIUS;
  const bounds = roomLightBounds(playerX, playerY, radius);
  for (let y = bounds.minY; y <= bounds.maxY && cells.length < PLAYER_GROUND_LIGHT_MAX_CELLS; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX && cells.length < PLAYER_GROUND_LIGHT_MAX_CELLS; x += 1) {
      addRoomCell({ world, cells, x, y, playerX, playerY, radius });
    }
  }
  return cells;
}

export function usesRoomGroundLight(worldY: number): boolean {
  return isRoomIsolationChunk(Math.floor(worldY / CHUNK_SIZE));
}

function addRoomCell(input: {
  readonly world: PlayerGroundLightWorld;
  readonly cells: PlayerGroundLightCell[];
  readonly x: number;
  readonly y: number;
  readonly playerX: number;
  readonly playerY: number;
  readonly radius: number;
}): void {
  const distance = Math.hypot(input.x + 0.5 - input.playerX, input.y + 0.5 - input.playerY);
  if (distance > input.radius || input.world.terrainAt(input.x, input.y) !== TERRAIN.Floor) return;
  const groundHeight = input.world.heightAt?.(input.x, input.y) ??
    input.world.groundAt(input.x + 0.5, input.y + 0.5);
  if (groundHeight >= ROOM_WALL_RISE) return;
  input.cells.push({
    tileX: input.x,
    tileY: input.y,
    strength: playerGroundLightStrength(distance),
    groundHeight,
  });
}

function roomLightBounds(
  playerX: number,
  playerY: number,
  radius: number,
): { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number } {
  return {
    minX: Math.floor(playerX - radius),
    maxX: Math.ceil(playerX + radius),
    minY: Math.floor(playerY - radius),
    maxY: Math.ceil(playerY + radius),
  };
}
