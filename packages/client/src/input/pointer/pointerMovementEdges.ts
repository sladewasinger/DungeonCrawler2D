import type Phaser from "phaser";
import { handlePointerMove, handlePointerUp } from "./pointer.js";
import type { TouchInputState } from "../touch/index.js";

/** Wires pointer control edges once; late touch activation is read at event time. */
export interface PointerMovementBindingOptions {
  scene: Phaser.Scene;
  touch: TouchInputState;
  touchActive(): boolean;
  onInteractReleased(): void;
  onThrowAimMove(pointer: Phaser.Input.Pointer): void;
  onThrowAimRelease(pointerId: number, allowThrow: boolean): void;
  onMovementEdge(): void;
}

export function bindPointerMovementEdges({ scene, touch, touchActive, onInteractReleased, onThrowAimMove, onThrowAimRelease, onMovementEdge }: PointerMovementBindingOptions): void {
  scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
    if (touchActive()) { handlePointerMove(touch, pointer); onThrowAimMove(pointer); }
  });
  const release = (pointer: Phaser.Input.Pointer) => {
    if (touchActive()) handlePointerUp({ touch, pointer, onInteractReleased, onThrowRelease: onThrowAimRelease, onMovementEdge });
    else onMovementEdge();
  };
  scene.input.on("pointerup", release);
  scene.input.on("pointerupoutside", release);
  scene.input.on("pointercancel", (pointer: Phaser.Input.Pointer) => {
    onThrowAimRelease(pointer.id, false);
    if (touchActive()) handlePointerUp({ touch, pointer, onInteractReleased, onMovementEdge });
  });
}
