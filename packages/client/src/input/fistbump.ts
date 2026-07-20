/**
 * Pure hold-vs-tap discriminator for the F key / touch interact button (Epic 7.10):
 * a quick tap keeps today's party invite/accept exactly as-is, a sustained hold
 * (>= 400ms, ASSUMPTION #20) fires the fistbump gesture exactly once instead.
 */

export const FISTBUMP_HOLD_MS = 400;
/** SHARED CONTRACT (wave 3): fistbump target must be within 2 tiles. */
export const FISTBUMP_RANGE_TILES = 2;

export interface HoldState {
  downAtMs: number | null;
  /** True once this hold crossed the threshold and fired — release must not also tap. */
  fired: boolean;
}

export function createHoldState(): HoldState {
  return { downAtMs: null, fired: false };
}

/** Key/button went down. Repeat events while already held are ignored. */
export function holdDown(state: HoldState, nowMs: number): void {
  if (state.downAtMs !== null) return;
  state.downAtMs = nowMs;
  state.fired = false;
}

/** 0..1 ring progress for the radial hold indicator; 0 when idle or already fired.
 * `holdMs` defaults to the fistbump threshold — input/revive.ts reuses this same
 * generic hold-state machine at its own duration instead of duplicating it. */
export function holdProgress(state: HoldState, nowMs: number, holdMs = FISTBUMP_HOLD_MS): number {
  if (state.downAtMs === null || state.fired) return 0;
  return Math.min(1, (nowMs - state.downAtMs) / holdMs);
}

/** Poll while held: returns true exactly once, on the tick the hold crosses the threshold. */
export function holdCrossedThreshold(state: HoldState, nowMs: number, holdMs = FISTBUMP_HOLD_MS): boolean {
  if (state.downAtMs === null || state.fired) return false;
  if (nowMs - state.downAtMs < holdMs) return false;
  state.fired = true;
  return true;
}

/** Key/button released: "tap" = short press (run the tap action), "held" = the
 * hold gesture already fired, "idle" = there was no tracked press (spurious keyup). */
export function holdUp(state: HoldState, nowMs: number, holdMs = FISTBUMP_HOLD_MS): "tap" | "held" | "idle" {
  if (state.downAtMs === null) return "idle";
  const wasFired = state.fired;
  const elapsed = nowMs - state.downAtMs;
  state.downAtMs = null;
  state.fired = false;
  if (wasFired) return "held";
  return elapsed < holdMs ? "tap" : "held";
}
