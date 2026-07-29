export type StatusParticleKind = "ember" | "oil";

export function particleProgress(nowMs: number, startedAtMs: number, durationMs: number): number {
  return Math.max(0, Math.min(1, (nowMs - startedAtMs) / durationMs));
}

export function particleAlpha(kind: StatusParticleKind, progress: number): number {
  if (kind === "ember") return (1 - progress) * 0.75;
  if (progress < 0.65) return 0.58;
  return Math.max(0, (1 - progress) / 0.35) * 0.58;
}

export function emberVerticalOffset(progress: number, bodyHeight: number): number {
  return -bodyHeight * (0.15 + progress * 0.7);
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
