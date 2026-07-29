// The seam's single client-side ViewState (2.5D rotation lane, step 3's prerequisite):
// which ViewOrientation the whole renderer currently draws at. The dungeon scene's
// Q/X controller changes it at runtime, but every low-level placement helper (worldToScreen,
// the terrain chunk pipeline, the lighting facade) reads it here rather than each
// threading an `orientation` parameter up through their entire Phaser scene call chain,
// which is fixed for the whole session today and would otherwise be a purely mechanical,
// no-behavior-change plumbing exercise across ~15 files (ASSUMPTIONS.md logs this as a
// deliberate call). The pure render/view/* math modules (viewTransform, directionRemap,
// viewDepth, rotationTween) never read this — they stay parameter-only and independently
// unit-testable; only Phaser-facing glue (worldToScreen, TerrainRenderer, LightingSystem)
// touches it.
import { normalizeOrientation, type ViewOrientation } from "../orientation/viewOrientation.js";

let current: ViewOrientation = 0;

/** The orientation every draw call this frame should render at. */
export function getViewOrientation(): ViewOrientation {
  return current;
}

/** Sets the settled orientation. Used by the live rotation controller and by the
 * dev-only `?vo=` startup override/gallery capture. */
export function setViewOrientation(orientation: number): void {
  current = normalizeOrientation(orientation);
}

/** Test-only convenience: restores the default (0) — vitest files that call
 * setViewOrientation should reset it in an afterEach so state doesn't leak between tests. */
export function resetViewOrientation(): void {
  current = 0;
}
