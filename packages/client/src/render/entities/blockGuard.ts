export const BLOCK_GUARD_RADIUS_TILES = 0.33;
export const BLOCK_GUARD_TINT = 0x8fd7ff;
export const BLOCK_GUARD_TILT_RAD = Math.PI / 12;

const BLOCK_BREATHE_PERIOD_MS = 720;
const BLOCK_BREATHE_RADIUS_TILES = 0.025;
const BLOCK_BREATHE_SCALE = 0.045;

export interface BlockGuardTransform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scale: number;
}

export const blockGuardTransform = (
  centerX: number,
  centerY: number,
  facingAngle: number,
  tilePx: number,
  nowMs: number,
): BlockGuardTransform => {
  const phase = (nowMs / BLOCK_BREATHE_PERIOD_MS) * Math.PI * 2;
  const wave = Math.sin(phase);
  const radius = (
    BLOCK_GUARD_RADIUS_TILES +
    wave * BLOCK_BREATHE_RADIUS_TILES
  ) * tilePx;
  return {
    x: centerX + Math.cos(facingAngle) * radius,
    y: centerY + Math.sin(facingAngle) * radius,
    rotation: facingAngle + BLOCK_GUARD_TILT_RAD,
    scale: 1 + wave * BLOCK_BREATHE_SCALE,
  };
};
