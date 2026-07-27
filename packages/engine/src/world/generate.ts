// Public entry point for chunk generation — delegates to world/generate/
// (the BSP room-and-corridor generator with district/avenue/landmark/chasm
// grafts; see world/generate/index.ts's doc comment and docs/PORT_PLAN.md's
// "Redesign after baseline"). Kept as a thin facade so world.ts's
// generateChunk(..., level) call site and the engine's public API surface
// don't need to change: the level parameter stays for World's API
// compatibility (sandbox proving-ground content is not part of this slice;
// every level generates the same dungeon layout).

import { generateChunk as generateLayoutChunk, type ChunkGenerationRequest } from "./generate/index.js";
import { LEVEL, type LevelId } from "./level.js";
import type { Chunk } from "./types.js";

export interface WorldGenerationRequest extends ChunkGenerationRequest {
  level?: LevelId;
}

export function generateChunk({ level = LEVEL.Dungeon, ...layout }: WorldGenerationRequest): Chunk {
  void level;
  return generateLayoutChunk(layout);
}
