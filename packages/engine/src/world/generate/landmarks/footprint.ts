import { DISTRICT, type DistrictKind } from "../layout/district.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";

const LANDMARKS = WORLD_GENERATION_TUNING.landmarks;

/** Square footprint radius stamped by a district's landmark. */
export function landmarkRadius(district: DistrictKind): number {
  if (district === DISTRICT.Warren || district === DISTRICT.Flooded) {
    return LANDMARKS.shrineRingRadius;
  }
  if (district === DISTRICT.Ruins) return LANDMARKS.towerOuterRadius;
  return LANDMARKS.arenaWallRadius;
}
