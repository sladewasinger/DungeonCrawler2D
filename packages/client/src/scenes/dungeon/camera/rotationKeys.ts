// [Q]/[X] camera-rotation key binding — kept as its own thin Phaser-facing glue file,
// separate from rotationControl.ts's Phaser-free state machine (docs/ASSUMPTIONS.md:
// physically Q/X, not literal Q/E, since E already owns Interact).
import type Phaser from "phaser";
import { isTypingInInput } from "../../../input/controls/state.js";
import type { RotationController } from "./rotationControl.js";

type RotationWindow = Window & {
  __dc2dRotationKeyHandler?: (event: KeyboardEvent) => void;
};

export const rotationDirectionForKey = (code: string): 1 | -1 | null => {
  if (code === "KeyQ") return -1;
  if (code === "KeyX") return 1;
  return null;
};

export function bindRotationKeys(
  scene: Phaser.Scene,
  rotation: RotationController,
  beforeRequest?: (direction: 1 | -1) => void,
): void {
  const rotationWindow = window as RotationWindow;
  if (rotationWindow.__dc2dRotationKeyHandler) {
    window.removeEventListener("keydown", rotationWindow.__dc2dRotationKeyHandler, true);
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    const direction = rotationDirectionForKey(event.code);
    if (direction === null || isTypingInInput()) return;
    event.preventDefault();
    beforeRequest?.(direction);
    rotation.request(direction);
  };
  rotationWindow.__dc2dRotationKeyHandler = onKeyDown;
  window.addEventListener("keydown", onKeyDown, true);
  scene.events.once("shutdown", () => {
    window.removeEventListener("keydown", onKeyDown, true);
    if (rotationWindow.__dc2dRotationKeyHandler === onKeyDown) {
      delete rotationWindow.__dc2dRotationKeyHandler;
    }
  });
}
