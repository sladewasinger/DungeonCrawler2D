// [Q]/[X] camera-rotation key binding — kept as its own thin Phaser-facing glue file,
// separate from rotationControl.ts's Phaser-free state machine (docs/ASSUMPTIONS.md:
// physically Q/X, not literal Q/E, since E already owns Interact).
import type Phaser from "phaser";
import { isTypingInInput } from "../../input/state.js";
import type { RotationController } from "./rotationControl.js";

export const rotationDirectionForKey = (code: string): 1 | -1 | null => {
  if (code === "KeyQ") return -1;
  if (code === "KeyX") return 1;
  return null;
};

export function bindRotationKeys(scene: Phaser.Scene, rotation: RotationController): void {
  const onKeyDown = (event: KeyboardEvent): void => {
    const direction = rotationDirectionForKey(event.code);
    if (direction === null || isTypingInInput()) return;
    event.preventDefault();
    rotation.request(direction);
  };
  window.addEventListener("keydown", onKeyDown, true);
  scene.events.once("shutdown", () => {
    window.removeEventListener("keydown", onKeyDown, true);
  });
}
