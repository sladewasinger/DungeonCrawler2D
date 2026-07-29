import { LEVEL, spawnRoomSpawn } from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { findSpawn } from "./spawn.js";

/** Protected handoff position for a fresh life; sandbox keeps its test cluster. */
export function findPlayerSpawn(
  sim: SimState,
  slotIndex: number,
): { x: number; y: number; z: number } {
  if (sim.world.level === LEVEL.Sandbox) return findSpawn(sim);
  const roomSpawn = spawnRoomSpawn(slotIndex);
  return {
    ...roomSpawn,
    z: sim.world.groundAt(roomSpawn.x, roomSpawn.y),
  };
}
