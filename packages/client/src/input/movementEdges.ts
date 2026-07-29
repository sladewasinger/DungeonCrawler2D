import type Phaser from "phaser";
import type { InputState } from "./controls/state.js";

/** Emits immediately when a keyboard movement control changes; prediction remains fixed-step. */
export function bindKeyboardMovementEdges(
  state: InputState,
  onEdge: () => void,
): void {
  const { keys, cursors } = state;
  bindKidModeToggles(state);
  const movementKeys: Phaser.Input.Keyboard.Key[] = [
    keys.W, keys.A, keys.S, keys.D, keys.B, keys.SPACE, keys.SHIFT,
    cursors.left, cursors.right, cursors.up, cursors.down, cursors.space, cursors.shift,
  ];
  for (const key of new Set(movementKeys)) {
    key.on("down", onEdge);
    key.on("up", onEdge);
  }
}

function bindKidModeToggles(state: InputState): void {
  const { keys, cursors } = state;
  for (const key of [cursors.left, cursors.right, cursors.up, cursors.down]) {
    key.on("down", () => {
      state.kidMode.active = true;
    });
  }
  for (const key of [keys.W, keys.A, keys.S, keys.D]) {
    key.on("down", () => {
      state.kidMode.active = false;
    });
  }
}
