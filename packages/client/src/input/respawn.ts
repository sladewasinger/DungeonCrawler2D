import {
  createHoldState,
  holdCrossedThreshold,
  holdDown,
  holdProgress,
  holdUp,
  type HoldState,
} from "./fistbump.js";

export const INSTANT_RESPAWN_HOLD_MS = 3_000;

export class RespawnGesture {
  private readonly hold: HoldState = createHoldState();

  begin(enabled: boolean, nowMs: number): void {
    if (enabled) holdDown(this.hold, nowMs);
  }

  end(nowMs: number): void {
    holdUp(this.hold, nowMs, INSTANT_RESPAWN_HOLD_MS);
  }

  poll(enabled: boolean, nowMs: number, sourceHeld = false): boolean {
    if (!enabled) {
      this.end(nowMs);
      return false;
    }
    if (sourceHeld) this.begin(true, nowMs);
    return holdCrossedThreshold(this.hold, nowMs, INSTANT_RESPAWN_HOLD_MS);
  }

  progress(enabled: boolean, nowMs: number): number {
    return enabled ? holdProgress(this.hold, nowMs, INSTANT_RESPAWN_HOLD_MS) : 0;
  }
}
