/** Coalesces unchanged movement intents while preserving immediate control-state changes. */
import type { MoveInput } from "@dc2d/engine";

export const INPUT_HEARTBEAT_TICKS = 1;

function sameDirection(left: MoveInput, right: MoveInput): boolean {
  return left.moveX === right.moveX &&
    left.moveY === right.moveY &&
    (left.faceX ?? 0) === (right.faceX ?? 0) &&
    (left.faceY ?? 0) === (right.faceY ?? 0);
}

function sameActions(left: MoveInput, right: MoveInput): boolean {
  return left.jump === right.jump &&
    (left.run ?? false) === (right.run ?? false) &&
    (left.block ?? false) === (right.block ?? false);
}

function sameInput(left: MoveInput, right: MoveInput): boolean {
  return sameDirection(left, right) && sameActions(left, right);
}

export class MovementCadence {
  private lastSent: MoveInput | null = null;
  private ticksSinceSend = INPUT_HEARTBEAT_TICKS;

  reset(): void {
    this.lastSent = null;
    this.ticksSinceSend = INPUT_HEARTBEAT_TICKS;
  }

  shouldSendEdge(input: MoveInput): boolean {
    if (this.lastSent && sameInput(this.lastSent, input)) return false;
    this.recordSend(input);
    return true;
  }

  shouldSend(input: MoveInput): boolean {
    this.ticksSinceSend++;
    if (this.lastSent && sameInput(this.lastSent, input) &&
      this.ticksSinceSend < INPUT_HEARTBEAT_TICKS) return false;
    this.recordSend(input);
    return true;
  }

  private recordSend(input: MoveInput): void {
    this.lastSent = { ...input };
    this.ticksSinceSend = 0;
  }
}
