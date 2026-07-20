// Landmark dispatch: one per super-chunk, stamped only on the landmark
// chunk, skipped where a safe-room kiosk or stairway pad already claimed
// the chunk (features/fixed.ts owns those, same as the plain layout).

import { isBossArenaChunk } from "../../features/bossArena.js";
import { isStairwayDownChunk, isStairwayUpChunk } from "../../features/descent.js";
import { isSafeRoomChunk, isStairsChunk } from "../../features/fixed.js";
import { DISTRICT, isLandmarkChunk, type DistrictKind } from "../district.js";
import { stampArena } from "./arena.js";
import { stampShrine } from "./shrine.js";
import { stampTower } from "./tower.js";

export function applyLandmark(
  kind: DistrictKind,
  seed: number,
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  corridorCarved: Uint8Array,
  tiles: Uint8Array,
  height: Float32Array,
): void {
  if (!isLandmarkChunk(cx, cy)) return;
  if (isSafeRoomChunk(worldSeed, floor, cx, cy)) return;
  if (isStairsChunk(worldSeed, floor, cx, cy)) return;
  if (isStairwayUpChunk(worldSeed, floor, cx, cy)) return;
  if (isStairwayDownChunk(worldSeed, floor, cx, cy)) return;
  if (isBossArenaChunk(worldSeed, floor, cx, cy)) return;

  if (kind === DISTRICT.Warren) stampShrine(worldSeed, floor, cx, cy, corridorCarved, tiles, height);
  else if (kind === DISTRICT.Ruins) stampTower(seed, worldSeed, floor, cx, cy, corridorCarved, tiles, height);
  else stampArena(worldSeed, floor, cx, cy, corridorCarved, tiles, height); // Plaza + PillarForest
}
