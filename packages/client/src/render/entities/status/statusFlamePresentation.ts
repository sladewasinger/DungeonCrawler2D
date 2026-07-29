import { AREA_ACTOR_FIRE_FLAMES } from "../../../vfx/areas/presentation/areaVisualStyle.js";

const FULL_CIRCLE = Math.PI * 2;
const SEED_PHASE_SCALE = 0.000_001;
const INDEX_PHASE_STEP = 2.399_963;

const FALLBACK_OFFSET = [0, -0.5] as const;

export function statusFlameOffset(index: number): readonly number[] {
  return AREA_ACTOR_FIRE_FLAMES.offsets[index] ?? FALLBACK_OFFSET;
}

export function statusFlameAlpha(
  seed: number,
  index: number,
  nowMs: number,
): number {
  const period = AREA_ACTOR_FIRE_FLAMES.pulsePeriodMs;
  const phase = seed * SEED_PHASE_SCALE + index * INDEX_PHASE_STEP;
  const pulse = Math.sin((nowMs / period) * FULL_CIRCLE + phase);
  return AREA_ACTOR_FIRE_FLAMES.alpha +
    pulse * AREA_ACTOR_FIRE_FLAMES.alphaPulse;
}

export function statusFlameDepth(bodyDepth: number): number {
  return bodyDepth + AREA_ACTOR_FIRE_FLAMES.depthBias;
}
