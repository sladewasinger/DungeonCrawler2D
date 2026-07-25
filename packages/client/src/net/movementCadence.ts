/** Coalesces unchanged movement intents while preserving immediate control-state changes. */
import type { MoveInput } from "@dc2d/engine";

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

  reset(): void {
    this.lastSent = null;
  }

  shouldSendEdge(input: MoveInput): boolean {
    return this.shouldSend(input);
  }

  shouldSend(input: MoveInput): boolean {
    if (this.lastSent && sameInput(this.lastSent, input)) return false;
    this.lastSent = { ...input };
    return true;
  }
}
