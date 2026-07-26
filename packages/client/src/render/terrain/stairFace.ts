import { stairVisualAt } from "@dc2d/engine";
import { ownFaceRowAt, type OwnFaceRow } from "./ownFace.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import { stacksVertically } from "./stairTread.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

export function visibleTerrainFaceAt(
  world: ViewTerrainWorld,
  wx: number,
  wy: number,
): OwnFaceRow | null {
  const face = ownFaceRowAt(world, wx, wy);
  if (!face) return null;
  const real = world.toReal(wx, wy);
  const stair = stairVisualAt(world.real, real.x, real.y);
  if (!stair) return face;
  const screenDirection = screenClimbDirIndex(stair.direction, world.orientation);
  return stacksVertically(screenDirection) ? null : face;
}
