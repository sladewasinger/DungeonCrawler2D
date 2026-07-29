// Direction remapping: which world compass side currently renders at which screen
// side. Independent of viewTransform.ts's point math (cross-checked against it in
// directionRemap.test.ts) but expressed as its own small cyclic table since callers
// (wall face selection, stair tread axis) think in compass terms, not (x, y) vectors.
import type { ViewOrientation } from "./viewOrientation.js";

export type CompassDir = "N" | "E" | "S" | "W";

/** Clockwise compass order — also the screen-slot order (screen-up, -right, -down, -left). */
const CYCLE: readonly CompassDir[] = ["N", "E", "S", "W"];

function stepsFor(orientation: ViewOrientation): number {
  return orientation / 90;
}

function cycleIndex(dir: CompassDir): number {
  return CYCLE.indexOf(dir);
}

/** The world compass direction that currently renders at screen-north ("up"). */
export function screenNorthWorldDirection(orientation: ViewOrientation): CompassDir {
  return CYCLE[stepsFor(orientation) % 4]!;
}

/** The world compass direction that currently renders at screen-south — wall faces
 * draw on whichever world side this returns (brief's step 2, "wall faces"). */
export function screenSouthWorldDirection(orientation: ViewOrientation): CompassDir {
  return CYCLE[(stepsFor(orientation) + 2) % 4]!;
}

/** Which screen slot (N/E/S/W, screen-up/right/down/left) a world compass direction
 * currently renders at. Inverse of screenNorthWorldDirection/screenSouthWorldDirection. */
export function screenSlotFor(worldDir: CompassDir, orientation: ViewOrientation): CompassDir {
  const idx = (cycleIndex(worldDir) - stepsFor(orientation) + 4) % 4;
  return CYCLE[idx]!;
}

/**
 * Stair tread line axis (debugArt.ts's `pickStairFrame` picks between these two frames):
 * treads stay perpendicular to the SCREEN climb direction. A world-north/south climb
 * renders vertical on screen at orientation 0/180 (screen slot N or S) -> horizontal
 * lines; the same climb renders horizontal on screen at 90/270 (screen slot E or W) ->
 * vertical lines. Matches the brief's own worked example exactly.
 */
export function stairTreadAxis(climbDir: CompassDir, orientation: ViewOrientation): "horizontal" | "vertical" {
  const screenSlot = screenSlotFor(climbDir, orientation);
  return screenSlot === "N" || screenSlot === "S" ? "horizontal" : "vertical";
}
