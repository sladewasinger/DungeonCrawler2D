import type { HoldState } from "./fistbump.js";
import { GiveUpGesture } from "./giveUp.js";
import { cancelHeldGestures } from "./modalGestures.js";
import { ReviveGesture } from "./revive.js";
import type { InputConnection } from "../controls/state.js";

export class LifeGestures {
  private readonly revive = new ReviveGesture();
  private readonly giveUp = new GiveUpGesture();

  beginRevive(conn: InputConnection, targetId: string | undefined, nowMs: number): boolean {
    if (!this.revive.begin(targetId, nowMs) || !targetId) return false;
    conn.revive(targetId, true);
    return true;
  }

  endInteract(conn: InputConnection, nowMs: number): void {
    this.endRevive(conn, nowMs);
    this.giveUp.end(nowMs);
  }

  private endRevive(conn: InputConnection, nowMs: number): void {
    const targetId = this.revive.end(nowMs);
    if (targetId) conn.revive(targetId, false);
  }

  beginGiveUp(enabled: boolean, nowMs: number): void {
    this.giveUp.begin(enabled, nowMs);
  }

  endGiveUp(nowMs: number): void {
    this.giveUp.end(nowMs);
  }

  pollRevive(conn: InputConnection, nowMs: number): void {
    if (!conn.canAct) this.endRevive(conn, nowMs);
  }

  pollGiveUp(conn: InputConnection, nowMs: number): void {
    if (this.giveUp.poll(conn.downed, nowMs)) conn.suicide();
  }

  giveUpProgress(downed: boolean, nowMs: number): number {
    return this.giveUp.progress(downed, nowMs);
  }

  reviveHoldView(nowMs: number): { targetId: string; progress: number } | null {
    return this.revive.holdView(nowMs);
  }

  reviveActive(): boolean {
    return this.revive.active();
  }

  cancel(nowMs: number, fistbump: HoldState): void {
    cancelHeldGestures(nowMs, { revive: this.revive, giveUp: this.giveUp, fistbump });
  }
}
