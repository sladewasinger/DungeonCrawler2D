/** Owns the deliberate hold-K gesture that lets a downed player surrender early. */
import {
  createHoldState,
  holdCrossedThreshold,
  holdDown,
  holdProgress,
  holdUp,
  type HoldState,
} from "./fistbump.js";

export const GIVE_UP_HOLD_MS = 1_500;

export class GiveUpGesture {
  private readonly hold: HoldState = createHoldState();

  begin(enabled: boolean, nowMs: number): void {
    if (enabled) holdDown(this.hold, nowMs);
  }

  end(nowMs: number): void {
    holdUp(this.hold, nowMs, GIVE_UP_HOLD_MS);
  }

  poll(enabled: boolean, nowMs: number): boolean {
    if (!enabled) {
      this.end(nowMs);
      return false;
    }
    return holdCrossedThreshold(this.hold, nowMs, GIVE_UP_HOLD_MS);
  }

  progress(enabled: boolean, nowMs: number): number {
    return enabled ? holdProgress(this.hold, nowMs, GIVE_UP_HOLD_MS) : 0;
  }
}
