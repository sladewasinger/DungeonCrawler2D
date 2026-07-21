// The seam's single client-side ViewState (2.5D rotation lane, step 3's prerequisite):
// which ViewOrientation the whole renderer currently draws at. THIS LANE never changes
// it at runtime — the game scene driving Q/E + a tween is explicitly next-lane scope
// (docs/ASSUMPTIONS.md row 250) — but every low-level placement helper (worldToScreen,
// the terrain chunk pipeline, the lighting facade) reads it here rather than each
// threading an `orientation` parameter up through their entire Phaser scene call chain,
// which is fixed for the whole session today and would otherwise be a purely mechanical,
// no-behavior-change plumbing exercise across ~15 files (ASSUMPTIONS.md logs this as a
// deliberate call). The pure render/view/* math modules (viewTransform, directionRemap,
// viewDepth, rotationTween) never read this — they stay parameter-only and independently
// unit-testable; only Phaser-facing glue (worldToScreen, TerrainRenderer, LightingSystem)
// touches it.
import { normalizeOrientation, type ViewOrientation } from "./viewOrientation.js";

let current: ViewOrientation = 0;

/** The orientation every draw call this frame should render at. */
export function getViewOrientation(): ViewOrientation {
  return current;
}

/** Dev/test hook — sets the fixed startup orientation. Not called by any in-game rotation
 * input this lane (there isn't one yet); see boot's `?vo=` query param and the gallery
 * capture script this lane's own regression gate uses to render all 4 orientations. */
export function setViewOrientation(orientation: number): void {
  current = normalizeOrientation(orientation);
}

/** Test-only convenience: restores the default (0) — vitest files that call
 * setViewOrientation should reset it in an afterEach so state doesn't leak between tests. */
export function resetViewOrientation(): void {
  current = 0;
}
