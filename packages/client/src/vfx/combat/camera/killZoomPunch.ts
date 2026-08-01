import { HIT_STOP_DURATION_MS, HIT_STOP_ZOOM } from "./hitStop.js";

/** Computes a transient multiplier; the responsive camera controller owns raw zoom. */
export class KillZoomPunch {
  private startedAtMs = -Infinity;

  constructor(private readonly setMultiplier: (multiplier: number) => void) {}

  trigger(nowMs: number): void {
    this.startedAtMs = nowMs;
    this.setMultiplier(1);
  }

  update(nowMs: number): void {
    this.setMultiplier(killPunchMultiplier(nowMs - this.startedAtMs));
  }
}

export function killPunchMultiplier(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= HIT_STOP_DURATION_MS) return 1;
  const halfDuration = HIT_STOP_DURATION_MS / 2;
  const phase = elapsedMs <= halfDuration
    ? elapsedMs / halfDuration
    : (HIT_STOP_DURATION_MS - elapsedMs) / halfDuration;
  return 1 + (HIT_STOP_ZOOM - 1) * phase;
}
