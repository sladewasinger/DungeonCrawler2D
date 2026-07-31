// Public entry point for chunk generation — delegates to the BSP
// room-and-corridor generator. Kept as a thin facade so world.ts's
// generateChunk(..., level) call site and the engine's public API surface
// don't need to change: the level parameter stays for World's API
// compatibility (sandbox proving-ground content is not part of this slice;
// every level generates the same dungeon layout).

import {
  generateChunk as generateLayoutChunk,
  generateDistrictChunks as generateLayoutDistrict,
  type ChunkGenerationRequest,
} from "./generate/index.js";
import { LEVEL, type LevelId } from "./core/level.js";
import { generateCombatSandboxChunk } from "./combatSandbox/combatSandboxChunk.js";
import type { WorldFeatures } from "./core/worldFeatures.js";
import type { Chunk } from "./core/types.js";

export interface WorldGenerationRequest extends ChunkGenerationRequest {
  level?: LevelId;
  features?: WorldFeatures;
}

export function generateChunk({ level = LEVEL.Dungeon, ...layout }: WorldGenerationRequest): Chunk {
  if (level === LEVEL.CombatSandbox) {
    return generateCombatSandboxChunk(layout.cx, layout.cy);
  }
  return generateLayoutChunk(layout);
}

export function generateDistrictChunks({
  level = LEVEL.Dungeon,
  ...layout
}: WorldGenerationRequest): readonly Chunk[] {
  if (level === LEVEL.CombatSandbox) {
    return [generateCombatSandboxChunk(layout.cx, layout.cy)];
  }
  return generateLayoutDistrict(layout);
}
