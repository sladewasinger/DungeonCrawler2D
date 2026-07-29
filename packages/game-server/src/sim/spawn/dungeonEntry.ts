import type { SimState } from "../state/state.js";
import { findWalkableNear } from "./search.js";

const ENTRY_SEARCH_RADIUS = 48;

/** Closest free dungeon floor to world origin, used by the one-way spawn-room exit. */
export function findDungeonEntry(
  sim: SimState,
): { x: number; y: number; z: number } {
  const occupied = occupiedPlayerTiles(sim);
  const tile = findWalkableNear({
    sim,
    x: 0,
    y: 0,
    maxRadius: ENTRY_SEARCH_RADIUS,
    avoid: occupied,
  }) ?? findWalkableNear({
    sim,
    x: 0,
    y: 0,
    maxRadius: ENTRY_SEARCH_RADIUS,
  });
  if (!tile) throw new Error("No walkable dungeon entry tile near (0, 0)");
  const x = tile.x + 0.5;
  const y = tile.y + 0.5;
  return { x, y, z: sim.world.groundAt(x, y) };
}

function occupiedPlayerTiles(sim: SimState): Set<string> {
  return new Set(
    [...sim.players.values()]
      .filter((slot) => slot.connected)
      .map((slot) => {
        const body = slot.entity.body;
        return `${Math.floor(body.x)},${Math.floor(body.y)}`;
      }),
  );
}
