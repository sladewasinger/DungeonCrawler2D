// Public entry point for finite floor generation and runtime chunk slicing.

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
