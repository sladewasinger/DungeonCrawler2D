/**
 * Hold-E revive gesture (Epic 7.12): reuses fistbump.ts's generic hold-state machine
 * at its own duration instead of duplicating it — a downed party member in interact
 * range gates hold-vs-instant-interact, mirroring the F key's hold-vs-tap split.
 */
import { createHoldState, holdCrossedThreshold, holdDown, holdProgress, holdUp, type HoldState } from "./fistbump.js";

export const REVIVE_HOLD_MS = 600;

export interface ReviveHoldState {
  readonly hold: HoldState;
  targetId: string | null;
}

export function createReviveHoldState(): ReviveHoldState {
  return { hold: createHoldState(), targetId: null };
}

/** E went down near a downed teammate: starts the hold instead of firing interact instantly. */
export function beginRevive(state: ReviveHoldState, targetId: string, nowMs: number): void {
  state.targetId = targetId;
  holdDown(state.hold, nowMs);
}

/** E released: clears any in-progress hold — an early release just cancels the revive attempt. */
export function endRevive(state: ReviveHoldState, nowMs: number): void {
  if (state.targetId === null) return;
  holdUp(state.hold, nowMs);
  state.targetId = null;
}

/** Poll each frame while held: true exactly once, the tick the hold crosses REVIVE_HOLD_MS. */
export function reviveCrossedThreshold(state: ReviveHoldState, nowMs: number): boolean {
  return state.targetId !== null && holdCrossedThreshold(state.hold, nowMs, REVIVE_HOLD_MS);
}

/** HUD ring view: target id + 0..1 progress, or null when idle. */
export function resolveReviveHoldView(
  state: ReviveHoldState,
  nowMs: number,
): { targetId: string; progress: number } | null {
  if (state.targetId === null) return null;
  const progress = holdProgress(state.hold, nowMs, REVIVE_HOLD_MS);
  return progress > 0 ? { targetId: state.targetId, progress } : null;
}

/** Stateful wrapper over the pure functions above — the single object input/index.ts
 * holds, so its own file stays a thin wiring layer under the line cap. */
export class ReviveGesture {
  private readonly state: ReviveHoldState = createReviveHoldState();

  /** [E] down: a downed party member in range starts the hold and returns true (caller
   * skips its normal instant-interact fallback); false when there's no target to revive. */
  begin(targetId: string | undefined, nowMs: number): boolean {
    if (!targetId) return false;
    beginRevive(this.state, targetId, nowMs);
    return true;
  }

  /** [E] up: cancels any in-progress hold. */
  end(nowMs: number): void {
    endRevive(this.state, nowMs);
  }

  /** Poll each frame while held: true exactly once, the tick the hold crosses REVIVE_HOLD_MS. */
  poll(nowMs: number): boolean {
    return reviveCrossedThreshold(this.state, nowMs);
  }

  /** HUD ring view: target id + 0..1 progress, or null when idle. */
  holdView(nowMs: number): { targetId: string; progress: number } | null {
    return resolveReviveHoldView(this.state, nowMs);
  }
}
