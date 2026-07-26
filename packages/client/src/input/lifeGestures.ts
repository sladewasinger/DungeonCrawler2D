import type { HoldState } from "./fistbump.js";
import { GiveUpGesture } from "./giveUp.js";
import { cancelHeldGestures } from "./modalGestures.js";
import { RespawnGesture } from "./respawn.js";
import { ReviveGesture } from "./revive.js";
import type { InputConnection } from "./state.js";

export class LifeGestures {
  private readonly revive = new ReviveGesture();
  private readonly giveUp = new GiveUpGesture();
  private readonly respawn = new RespawnGesture();

  beginRevive(targetId: string | undefined, nowMs: number): boolean {
    return this.revive.begin(targetId, nowMs);
  }

  endInteract(nowMs: number): void {
    this.revive.end(nowMs);
    this.respawn.end(nowMs);
  }

  beginGiveUp(enabled: boolean, nowMs: number): void {
    this.giveUp.begin(enabled, nowMs);
  }

  endGiveUp(nowMs: number): void {
    this.giveUp.end(nowMs);
  }

  beginRespawn(nowMs: number): void {
    this.respawn.begin(true, nowMs);
  }

  pollRevive(conn: InputConnection, nowMs: number): void {
    if (this.revive.poll(nowMs)) conn.interact();
  }

  pollGiveUp(conn: InputConnection, nowMs: number): void {
    if (this.giveUp.poll(conn.downed, nowMs)) conn.suicide();
  }

  pollRespawn(conn: InputConnection, nowMs: number): void {
    if (this.respawn.poll(conn.dead, nowMs)) conn.respawnNow();
  }

  respawnProgress(dead: boolean, nowMs: number): number {
    return this.respawn.progress(dead, nowMs);
  }

  reviveHoldView(nowMs: number): { targetId: string; progress: number } | null {
    return this.revive.holdView(nowMs);
  }

  reviveActive(): boolean {
    return this.revive.active();
  }

  cancel(nowMs: number, fistbump: HoldState): void {
    cancelHeldGestures(nowMs, this.revive, this.giveUp, this.respawn, fistbump);
  }
}
