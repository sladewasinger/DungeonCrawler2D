const WORLD_DEPTH_CENTER = 2;
const WORLD_DEPTH_RANGE = 0.42;
const WORLD_DEPTH_SCALE = 512;

export const TERRAIN_BASE_DEPTH = -10;
export const TERRAIN_BORDER_DEPTH = -9.5;
export const WALL_TOP_ENTITY_DEPTH = 3.5;
export const WORLD_OVERLAY_DEPTH = 4;
export const SELF_GHOST_DEPTH = 4.5;
export const AIM_PREVIEW_DEPTH = 5;
export const HUD_DEPTH = 100;

export function worldDepth(y: number, elevation = 0, bias = 0): number {
  const logicalFoot = y + elevation;
  const normalizedFoot = logicalFoot / WORLD_DEPTH_SCALE;
  const localRowDepth =
    WORLD_DEPTH_RANGE / (Math.PI * WORLD_DEPTH_SCALE * (1 + normalizedFoot * normalizedFoot));
  return (
    WORLD_DEPTH_CENTER +
    (Math.atan(normalizedFoot) / Math.PI) * WORLD_DEPTH_RANGE +
    bias * localRowDepth
  );
}

export function entityDepth(y: number, elevation: number, bias = 0): number {
  return worldDepth(y, elevation, bias);
}

export function terrainOccluderDepth(tileY: number, bias = 0): number {
  return worldDepth(tileY + 1, 0, bias);
}

