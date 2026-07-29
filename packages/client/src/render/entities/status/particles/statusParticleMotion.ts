/** Deterministic motion shared by the fixed-capacity actor status slots. */
export type StatusParticleKind = "fire-spark" | "oil-drop" | "poison-gas";

export const FIRE_SPARK_PARTICLE = "fire-spark";
export const OIL_DROP_PARTICLE = "oil-drop";
export const POISON_GAS_PARTICLE = "poison-gas";

export function particleProgress(nowMs: number, startedAtMs: number, durationMs: number): number {
  return Math.max(0, Math.min(1, (nowMs - startedAtMs) / durationMs));
}

export function particleAlpha(kind: StatusParticleKind, progress: number): number {
  if (kind === "fire-spark") return 1 - progress;
  if (kind === "poison-gas") {
    const fadeIn = Math.min(1, progress / 0.2);
    return fadeIn * (1 - progress);
  }
  if (progress < 0.65) return 1;
  return Math.max(0, (1 - progress) / 0.35);
}

export function fireSparkVerticalOffset(progress: number, bodyHeight: number): number {
  return -bodyHeight * (0.15 + progress * 0.7);
}

export function poisonGasVerticalOffset(progress: number, bodyHeight: number): number {
  return -bodyHeight * (0.08 + progress * 0.82);
}

export function oilVerticalOffset(
  progress: number,
  bodyHeight: number,
  groundDistance: number,
): number {
  const fallProgress = Math.min(1, progress / 0.65);
  return -bodyHeight * 0.55 * (1 - fallProgress) + groundDistance * fallProgress;
}

export function statusParticleNoise(seed: number, sequence: number): number {
  let value = (seed ^ Math.imul(sequence + 1, 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}
