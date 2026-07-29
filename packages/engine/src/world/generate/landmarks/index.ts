// Landmark dispatch: one per district, stamped only on the landmark
// chunk, skipped where a safe-room kiosk or stairway pad already claimed
// the chunk (features/fixed.ts owns those, same as the plain layout).

import { isBossArenaChunk } from "../../features/bossArena/bossArena.js";
import { isStairwayDownChunk, isStairwayUpChunk } from "../../features/descent/descent.js";
import { isSafeRoomChunk, isStairsChunk } from "../../features/fixed/fixed.js";
import { DISTRICT, isLandmarkChunk, type DistrictKind } from "../layout/district.js";
import { stampArena } from "./arena.js";
import { stampShrine } from "./shrine.js";
import { stampTower } from "./tower.js";

export interface LandmarkApplication {
  kind: DistrictKind;
  seed: number;
  worldSeed: number;
  floor: number;
  cx: number;
  cy: number;
  corridorCarved: Uint8Array;
  tiles: Uint8Array;
  height: Float32Array;
}

export function applyLandmark(input: LandmarkApplication): void {
  const { kind, seed, worldSeed, floor, cx, cy, corridorCarved, tiles, height } = input;
  if (!isLandmarkChunk(cx, cy)) return;
  const chunk = { worldSeed, floor, cx, cy };
  if (isClaimedChunk(chunk)) return;
  stampDistrictLandmark({ kind, seed, worldSeed, floor, cx, cy, corridorCarved, tiles, height });
}

function isClaimedChunk(chunk: { worldSeed: number; floor: number; cx: number; cy: number }): boolean {
  return isSafeRoomChunk(chunk) || isStairsChunk(chunk) || isStairwayUpChunk(chunk) || isStairwayDownChunk(chunk) || isBossArenaChunk(chunk);
}

function stampDistrictLandmark({ kind, seed, worldSeed, floor, cx, cy, corridorCarved, tiles, height }: LandmarkApplication): void {
  const stamp = { seed, worldSeed, floor, cx, cy, corridorCarved, tiles, height };
  if (kind === DISTRICT.Warren || kind === DISTRICT.Flooded) return stampShrine(stamp);
  if (kind === DISTRICT.Ruins) return stampTower(stamp);
  stampArena(stamp);
}
