// Low-HP screen warning: a red vignette that throbs at heartbeat tempo once self hp
// drops below 30% — TOURIST/BOOKFAN's "chipped from 30 HP to 0 with zero warning"
// demand. Pure function of (hpRatio, wallClockMs) so the pulse curve is
// unit-testable apart from the Graphics overlay it eventually drives; no spawn-time
// bookkeeping needed since the wall clock alone determines phase.

export const LOW_HP_RATIO = 0.3;
const BASE_ALPHA = 0.16;
const PULSE_AMPLITUDE = 0.24;
/** Heartbeat period at just-below-threshold (calm) down to near-death (urgent). */
const CALM_PERIOD_MS = 1000;
const URGENT_PERIOD_MS = 380;
/** Beat width as a fraction of one period — how sharp each throb reads. */
const BEAT_WIDTH = 0.06;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function isLowHp(hpRatio: number): boolean {
  return hpRatio > 0 && hpRatio < LOW_HP_RATIO;
}

/** Tempo scales with severity: full hp-below-threshold is calm, near-zero hp is urgent. */
export function heartbeatPeriodMs(hpRatio: number): number {
  const severity = clamp01(1 - hpRatio / LOW_HP_RATIO);
  return CALM_PERIOD_MS - (CALM_PERIOD_MS - URGENT_PERIOD_MS) * severity;
}

/** Distance from `phase` to `center` on a 0..1 wrapped ring (period boundary wraps). */
function ringDistance(phase: number, center: number): number {
  const d = Math.abs(phase - center);
  return Math.min(d, 1 - d);
}

/** One triangular throb centered at `center` (0..1 phase), 1 at the peak, 0 past BEAT_WIDTH. */
function beat(phase: number, center: number): number {
  return Math.max(0, 1 - ringDistance(phase, center) / BEAT_WIDTH);
}

/** "Lub-dub": a strong beat at the top of the cycle, a softer echo shortly after. */
function heartbeatPulse(phase: number): number {
  return Math.max(beat(phase, 0), beat(phase, 0.18) * 0.7);
}

/** Vignette alpha (0 when hp isn't low) for a given self hp ratio and wall-clock time. */
export function lowHpVignetteAlpha(hpRatio: number, nowMs: number): number {
  if (!isLowHp(hpRatio)) return 0;
  const period = heartbeatPeriodMs(hpRatio);
  const phase = (nowMs % period) / period;
  return BASE_ALPHA + PULSE_AMPLITUDE * heartbeatPulse(phase);
}
