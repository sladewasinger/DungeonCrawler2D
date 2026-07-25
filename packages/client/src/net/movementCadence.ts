/** Coalesces unchanged movement intents while preserving immediate control-state changes. */
import type { MoveInput } from "@dc2d/engine";

export const INPUT_HEARTBEAT_TICKS = 10;

function comparableInput(input: MoveInput): readonly (number | boolean)[] {
  return [
    input.moveX,
    input.moveY,
    input.faceX ?? 0,
    input.faceY ?? 0,
    input.jump,
    input.run ?? false,
    input.block ?? false,
  ];
}

function sameInput(left: MoveInput, right: MoveInput): boolean {
  const leftFields = comparableInput(left);
  const rightFields = comparableInput(right);
  return leftFields.every((value, index) => value === rightFields[index]);
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
