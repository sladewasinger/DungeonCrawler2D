// [Q]/[X] camera-rotation key binding — kept as its own thin Phaser-facing glue file,
// separate from rotationControl.ts's Phaser-free state machine (docs/ASSUMPTIONS.md:
// physically Q/X, not literal Q/E, since E already owns Interact).
import type Phaser from "phaser";
import { isTypingInInput } from "../../input/state.js";
import type { RotationController } from "./rotationControl.js";

export function bindRotationKeys(scene: Phaser.Scene, rotation: RotationController): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;
  keyboard.addKey("Q").on("down", () => {
    if (!isTypingInInput()) rotation.request(-1);
  });
  keyboard.addKey("X").on("down", () => {
    if (!isTypingInInput()) rotation.request(1);
  });
}
