/** Coalesces unchanged movement intents while preserving immediate control-state changes. */
import type { MoveInput } from "@dc2d/engine";

export const INPUT_HEARTBEAT_TICKS = 10;

function sameAxis(left: number | undefined, right: number | undefined): boolean {
  return (left ?? 0) === (right ?? 0);
}

function sameInput(left: MoveInput, right: MoveInput): boolean {
  return left.moveX === right.moveX &&
    left.moveY === right.moveY &&
    sameAxis(left.faceX, right.faceX) &&
    sameAxis(left.faceY, right.faceY) &&
    left.jump === right.jump &&
    (left.run ?? false) === (right.run ?? false);
}

export class MovementCadence {
  private lastSent: MoveInput | null = null;
  private ticksSinceSend = INPUT_HEARTBEAT_TICKS;

  reset(): void {
    this.lastSent = null;
    this.ticksSinceSend = INPUT_HEARTBEAT_TICKS;
  }

  shouldSend(input: MoveInput): boolean {
    this.ticksSinceSend++;
    if (this.lastSent && sameInput(this.lastSent, input) &&
      this.ticksSinceSend < INPUT_HEARTBEAT_TICKS) return false;
    this.lastSent = { ...input };
    this.ticksSinceSend = 0;
    return true;
  }
}
