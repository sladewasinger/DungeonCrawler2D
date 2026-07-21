/**
 * Camera-relative movement remap (2.5D rotation lane, LANE W2 step 3): WASD/joystick
 * intent is authored in SCREEN space (screen-up = "forward", matching what the player
 * actually sees), but the shared engine's stepBody only ever understands WORLD space.
 * This is the one choke point that converts a screen-space MoveInput to world-space
 * BEFORE it ever reaches Connection.sampleInput — the sim never sees view space
 * (docs/ASSUMPTIONS.md, LANE W2 brief). Reuses viewToWorld directly for the conversion:
 * it's a pure rotation matrix (no translation, see viewTransform.ts), so it's exactly as
 * valid applied to a direction vector as to a position.
 */
import type { MoveInput } from "@dc2d/engine";
import { viewToWorld, type ViewOrientation } from "../render/view/index.js";

/** Rotates a screen-space (moveX, moveY) intent into world-space at `orientation`; jump/run pass through untouched. */
export function screenMoveToWorld(move: MoveInput, orientation: ViewOrientation): MoveInput {
  const world = viewToWorld({ x: move.moveX, y: move.moveY }, orientation);
  return { ...move, moveX: world.x, moveY: world.y };
}

/** Rotates a screen-space direction vector (e.g. touch's last-facing, stored screen-relative
 * since there's no mouse to aim with) into world-space — the same choke point pointer.ts's
 * cursorWorldTile uses for mouse aim, exposed here for touch's separate call sites. */
export function screenDirToWorld(dir: { x: number; y: number }, orientation: ViewOrientation): { x: number; y: number } {
  return viewToWorld(dir, orientation);
}
