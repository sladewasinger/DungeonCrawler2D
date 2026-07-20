// Proximity resolution for Epic 7.14's descent landmarks: pure distance checks against
// the same deterministic StairwayDown/StairwayUp world positions the engine's descent.ts
// exposes (no TILE type — interaction is proximity-based, matching the server's own
// `doDescend` gate in game-server/src/sim/actions/descend.ts).
import { INTERACT_RANGE, stairwayDownPosition, stairwayUpPosition } from "@dc2d/engine";
import type { StairwayDirection } from "./descentPrompt.js";

export interface StairwayPrompt {
  readonly direction: StairwayDirection;
  /** The destination floor this stairway leads to. */
  readonly floor: number;
}

/** Just the two fields descent.ts's position lookups need — `World` satisfies this
 * structurally, but a narrower shape keeps this module (and its tests) decoupled
 * from the rest of World's surface. */
export interface StairwayWorld {
  readonly worldSeed: number;
  readonly floor: number;
}

function within(x: number, y: number, target: { x: number; y: number }): boolean {
  return Math.hypot(target.x - x, target.y - y) <= INTERACT_RANGE;
}

/** The nearby stairway (if any) at world position (x, y) on `world`'s current floor —
 * down takes priority on the vanishingly rare chance both are simultaneously in range. */
export function resolveStairwayPrompt(world: StairwayWorld, x: number, y: number): StairwayPrompt | null {
  const down = stairwayDownPosition(world);
  if (down && within(x, y, down)) return { direction: "down", floor: world.floor + 1 };
  const up = stairwayUpPosition(world);
  if (up && within(x, y, up)) return { direction: "up", floor: world.floor - 1 };
  return null;
}
