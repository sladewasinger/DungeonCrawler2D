// Public entry point for chunk generation — delegates to world/generate/
// (the BSP room-and-corridor generator with district/avenue/landmark/chasm
// grafts; see world/generate/index.ts's doc comment and docs/PORT_PLAN.md's
// "Redesign after baseline"). Kept as a thin facade so world.ts's
// generateChunk(..., level) call site and the engine's public API surface
// don't need to change: the level parameter stays for World's API
// compatibility (sandbox proving-ground content is not part of this slice;
// every level generates the same dungeon layout).

import { generateChunk as generateLayoutChunk } from "./generate/index.js";
import { LEVEL, type LevelId } from "./level.js";
import type { Chunk } from "./types.js";

export function generateChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  _level: LevelId = LEVEL.Dungeon,
): Chunk {
  return generateLayoutChunk(worldSeed, floor, cx, cy);
}
