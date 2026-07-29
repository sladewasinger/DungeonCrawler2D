import { hash2D, mixSeeds } from "../../../core/rng.js";
import { minimumRaisedSurfaceDepth } from "../../generate/terrain/verticalExtent.js";
import { WORLD_GENERATION_TUNING } from "../../generate/tuning.js";
import type {
  MiniBossArenaChunk,
  MiniBossArenaPlatform,
} from "./miniBossArena.js";

const TUNING = WORLD_GENERATION_TUNING.miniBossArena;
const PLATFORM_SALT = 0x7a11;

export function miniBossArenaPlatforms(
  chunk: MiniBossArenaChunk,
  center: { readonly x: number; readonly y: number },
): readonly MiniBossArenaPlatform[] {
  const seed = mixSeeds(chunk.worldSeed, chunk.floor, PLATFORM_SALT);
  const roll = hash2D(seed, chunk.cx, chunk.cy);
  const candidates = platformCandidates(center);
  const start = roll % candidates.length;
  const stride = roll % 2 === 0 ? 1 : candidates.length - 1;
  return Array.from({ length: TUNING.platformCount }, (_, index) => {
    const candidateIndex = (start + index * stride) % candidates.length;
    return requiredPlatform(candidates, candidateIndex);
  });
}

function requiredPlatform(
  candidates: readonly MiniBossArenaPlatform[],
  index: number,
): MiniBossArenaPlatform {
  const candidate = candidates[index];
  if (!candidate) throw new Error("mini-boss arena platform index is invalid");
  return candidate;
}

function platformCandidates(
  center: { readonly x: number; readonly y: number },
): readonly MiniBossArenaPlatform[] {
  const offset = TUNING.platformOffset;
  const height = TUNING.platformRise;
  const screenDepthTiles = minimumRaisedSurfaceDepth(height);
  return [
    { x: center.x - offset, y: center.y - offset, height, screenDepthTiles },
    { x: center.x + offset, y: center.y - offset, height, screenDepthTiles },
    { x: center.x + offset, y: center.y + offset, height, screenDepthTiles },
    { x: center.x - offset, y: center.y + offset, height, screenDepthTiles },
  ];
}
