import { spawnRoomExteriorSite } from "@dc2d/engine";
import type { SimState } from "../state/state.js";

/** First open apron tile immediately outside the visible spawn-room facade. */
export function findDungeonEntry(
  sim: SimState,
): { x: number; y: number; z: number } {
  const occupied = occupiedPlayerTiles(sim);
  const positions = spawnRoomExteriorSite().landingPositions;
  const destination = positions.find((position) => {
    const tileX = Math.floor(position.x);
    const tileY = Math.floor(position.y);
    return sim.world.isWalkable(tileX, tileY) &&
      !occupied.has(`${tileX},${tileY}`);
  }) ?? positions.find((position) => {
    return sim.world.isWalkable(
      Math.floor(position.x),
      Math.floor(position.y),
    );
  });
  if (!destination) {
    throw new Error("Spawn-room exterior has no walkable landing tile");
  }
  const { x, y } = destination;
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
