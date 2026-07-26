export interface ThreeGroundedDepthContract {
  readonly worldY: number;
  readonly depthTest: true;
  readonly depthWrite: true;
}

/**
 * Three uses physical depth rather than Phaser painter rows. Grounded objects retain
 * authoritative elevation and opt into the depth buffer so floors cannot cover an
 * object above them while genuine walls still occlude it.
 */
export function threeGroundedDepth(
  groundHeight: number,
  modelGroundOffset: number,
): ThreeGroundedDepthContract {
  return {
    worldY: groundHeight + modelGroundOffset,
    depthTest: true,
    depthWrite: true,
  };
}
