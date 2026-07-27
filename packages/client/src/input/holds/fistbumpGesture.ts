import { FISTBUMP_RANGE_TILES, createHoldState, holdCrossedThreshold, holdDown, holdProgress, holdUp, syncHoldSource, type HoldState } from "../fistbump.js";
import type { InputConnection, InputQueries } from "../state.js";
import { isButtonHeld, type TouchInputState } from "../touch/index.js";

export interface FistbumpPollRequest {
  readonly touchActive: boolean;
  readonly touch: TouchInputState;
  readonly keyboardHeld: boolean;
  readonly reviveActive: boolean;
  readonly conn: InputConnection;
  readonly queries: InputQueries;
  readonly nowMs: number;
}

interface TouchSyncRequest {
  readonly touchActive: boolean;
  readonly touch: TouchInputState;
  readonly reviveActive: boolean;
  readonly nowMs: number;
}

export class FistbumpGesture {
  private readonly hold: HoldState = createHoldState();
  private targetId: string | null = null;
  private touchHeld = false;

  down(nowMs: number): void { holdDown(this.hold, nowMs); }

  release(conn: InputConnection, queries: InputQueries, nowMs: number): void {
    const result = holdUp(this.hold, nowMs);
    this.targetId = null;
    if (result !== "tap") return;
    if (conn.pendingInvite) return conn.partyOp("accept");
    const nearest = queries.nearestPlayerId(conn, 6);
    if (nearest) conn.partyOp("invite", nearest);
  }

  poll(request: FistbumpPollRequest): void {
    const { touchActive, touch, keyboardHeld, reviveActive, conn, queries, nowMs } = request;
    this.syncTouch({ touchActive, touch, reviveActive, nowMs });
    if (!keyboardHeld && !this.touchHeld) return;
    this.targetId = queries.nearestPlayerId(conn, FISTBUMP_RANGE_TILES) ?? null;
    if (this.targetId && holdCrossedThreshold(this.hold, nowMs)) conn.fistbump(this.targetId);
  }

  cancel(touchActive: boolean, touch: TouchInputState): void {
    this.targetId = null;
    this.touchHeld = touchActive && isButtonHeld(touch, "interact");
  }

  resetTouch(): void { this.touchHeld = false; }

  holdForCancellation(): HoldState { return this.hold; }

  view(nowMs: number): { targetId: string; progress: number } | null {
    if (!this.targetId) return null;
    const progress = holdProgress(this.hold, nowMs);
    return progress > 0 ? { targetId: this.targetId, progress } : null;
  }

  private syncTouch({ touchActive, touch, reviveActive, nowMs }: TouchSyncRequest): void {
    if (!touchActive) return;
    const held = !reviveActive && isButtonHeld(touch, "interact");
    const nextHeld = syncHoldSource({ state: this.hold, wasHeld: this.touchHeld, held, nowMs });
    if (this.touchHeld && !nextHeld) this.targetId = null;
    this.touchHeld = nextHeld;
  }
}
