import {
  depthForCapOccluder,
  depthForEntity,
  depthForGroundEffect,
} from "../../../render/entities/presentation/depthSort.js";
import {
  AREA_CLOUD_ROW_INSET,
  AREA_FIRE_CORE_UNDERLAY_BIAS,
} from "./areaVisualStyle.js";

/**
 * Row-local depth band for area effects. A fixed global depth cannot work in an
 * unbounded, depth-sorted dungeon: it eventually puts a distant floor effect in
 * front of every entity. Keep each material in its semantic slot within one
 * projected screen row instead.
 */
export interface AreaVisualDepths {
  readonly terrain: number;
  readonly liquid: number;
  readonly bodyFloor: number;
  readonly fireCore: number;
  readonly cloud: number;
}

export function areaVisualDepthsForRow(row: number): AreaVisualDepths {
  const cloud = depthForEntity(row + 1) - AREA_CLOUD_ROW_INSET;
  return {
    terrain: depthForCapOccluder(row),
    liquid: depthForGroundEffect(row),
    bodyFloor: depthForEntity(row),
    fireCore: cloud - AREA_FIRE_CORE_UNDERLAY_BIAS,
    cloud,
  };
}
