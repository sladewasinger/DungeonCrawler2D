import type Phaser from "phaser";
import type { InputState } from "./controls/state.js";

/** Emits immediately when a keyboard movement control changes; prediction remains fixed-step. */
export function bindKeyboardMovementEdges(
  state: InputState,
  onEdge: () => void,
): void {
  const { keys, cursors } = state;
  const movementKeys: Phaser.Input.Keyboard.Key[] = [
    keys.W, keys.A, keys.S, keys.D, keys.SPACE, keys.SHIFT,
    cursors.left, cursors.right, cursors.up, cursors.down, cursors.space, cursors.shift,
  ];
  for (const key of new Set(movementKeys)) {
    key.on("down", onEdge);
    key.on("up", onEdge);
  }
}
