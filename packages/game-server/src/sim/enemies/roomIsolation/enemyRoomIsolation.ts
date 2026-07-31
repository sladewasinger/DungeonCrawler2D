import { CHUNK_SIZE, isRoomIsolationChunk } from "@dc2d/engine";
import type { SimState } from "../../state/state.js";

interface EnemyPosition {
  readonly x: number;
  readonly y: number;
}

/** Reserved room space belongs to players and friendly room occupants only. */
export function enemyOccupancyIsAllowed(
  sim: SimState,
  position: EnemyPosition,
): boolean {
  return !positionIsInReservedRoom(position) &&
    !sim.world.isSanctuary(position.x, position.y);
}

export function positionIsInReservedRoom(position: EnemyPosition): boolean {
  return isRoomIsolationChunk(Math.floor(position.y / CHUNK_SIZE));
}

/** Removes any hostile introduced by stale state or an unchecked mutation. */
export function removeProtectedRoomEnemies(sim: SimState): void {
  for (const [id, enemy] of sim.enemies) {
    if (enemyOccupancyIsAllowed(sim, enemy.entity.body)) continue;
    sim.enemies.delete(id);
    sim.replicationMotion.delete(id);
  }
}
