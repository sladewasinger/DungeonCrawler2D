import type Phaser from "phaser";
import { handlePointerMove, handlePointerUp } from "./pointer.js";
import type { TouchInputState } from "./touch/index.js";

/** Wires pointer control edges once; late touch activation is read at event time. */
export function bindPointerMovementEdges(
  scene: Phaser.Scene,
  touch: TouchInputState,
  touchActive: () => boolean,
  onInteractReleased: () => void,
  onMovementEdge: () => void,
): void {
  scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
    if (touchActive()) handlePointerMove(touch, pointer, onMovementEdge);
  });
  const release = (pointer: Phaser.Input.Pointer) => {
    if (touchActive()) handlePointerUp(touch, pointer, onInteractReleased, onMovementEdge);
    else onMovementEdge();
  };
  scene.input.on("pointerup", release);
  scene.input.on("pointerupoutside", release);
}
