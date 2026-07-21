// Draws contactShade.ts's baked-AO facts as nested translucent rects — the
// stepped-gradient rendering of the fake-AO polish item, flat color bands in
// the approved debug style (gradients, not textures; same primitive family as
// edgeLine.ts). Surface content: rides the owning cell's own `liftPx`, so a
// pit floor's shade sinks with its floor and a terrace's shade rides its cap,
// and bakes into the chunk textures with zero per-frame cost. Unlit black
// overlay by design — occlusion darkness is the absence of light, so it
// multiplies visually UNDER the baked torch warmth rather than tinting with it.
import type Phaser from "phaser";
import {
  AO_BAND_FRACS,
  AO_CORNER_FRAC,
  aoBandAlphas,
  aoCornerAlpha,
  contactShadeAt,
  getAOStrength,
} from "./contactShade.js";
import type { EdgeSide } from "./edgeLine.js";
import { isChasmDepth } from "./heightShade.js";
import { placeFractionalRect } from "./placeSprite.js";
import type { TerrainRead } from "./faces.js";

/** Near-black with the palette's blue cast (VISUAL_DIRECTION's shadow family). */
const SHADE_COLOR = 0x06060c;

const FULL: readonly [number, number] = [0, 1];

/** One side's nested gradient: three bands hugging that edge, widest faintest. */
function drawSideBands(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  side: EdgeSide,
  alphas: readonly [number, number, number],
  liftPx: number,
): void {
  for (let i = 0; i < AO_BAND_FRACS.length; i++) {
    const w = AO_BAND_FRACS[i] ?? 0;
    const alpha = alphas[i] ?? 0;
    const near: readonly [number, number] = [0, w];
    const far: readonly [number, number] = [1 - w, 1];
    if (side === "north") placeFractionalRect(scene, container, wx, wy, FULL, near, SHADE_COLOR, alpha, liftPx);
    else if (side === "south") placeFractionalRect(scene, container, wx, wy, FULL, far, SHADE_COLOR, alpha, liftPx);
    else if (side === "west") placeFractionalRect(scene, container, wx, wy, near, FULL, SHADE_COLOR, alpha, liftPx);
    else placeFractionalRect(scene, container, wx, wy, far, FULL, SHADE_COLOR, alpha, liftPx);
  }
}

/** The diagonal-only corner patches, one small square per active corner. */
function drawCornerPatches(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  corners: { nw: boolean; ne: boolean; sw: boolean; se: boolean },
  alpha: number,
  liftPx: number,
): void {
  const lo: readonly [number, number] = [0, AO_CORNER_FRAC];
  const hi: readonly [number, number] = [1 - AO_CORNER_FRAC, 1];
  if (corners.nw) placeFractionalRect(scene, container, wx, wy, lo, lo, SHADE_COLOR, alpha, liftPx);
  if (corners.ne) placeFractionalRect(scene, container, wx, wy, hi, lo, SHADE_COLOR, alpha, liftPx);
  if (corners.sw) placeFractionalRect(scene, container, wx, wy, lo, hi, SHADE_COLOR, alpha, liftPx);
  if (corners.se) placeFractionalRect(scene, container, wx, wy, hi, hi, SHADE_COLOR, alpha, liftPx);
}

/**
 * Bakes this cell's contact-shadow treatment into `container` (the same
 * shifted surface container as its floor art): a gradient band along every
 * side with a wall/cliff above it, plus small corner patches where only a
 * diagonal caster touches. Chasm-depth cells skip — they are already the
 * near-black void, and more darkness there is pure overdraw.
 */
export function drawContactShade(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: TerrainRead,
  wx: number,
  wy: number,
  height: number,
  liftPx: number,
): void {
  const strength = getAOStrength();
  if (strength <= 0 || isChasmDepth(height)) return;
  const { sides, corners } = contactShadeAt(world, wx, wy);
  const alphas = aoBandAlphas(strength);
  if (sides.north) drawSideBands(scene, container, wx, wy, "north", alphas, liftPx);
  if (sides.south) drawSideBands(scene, container, wx, wy, "south", alphas, liftPx);
  if (sides.west) drawSideBands(scene, container, wx, wy, "west", alphas, liftPx);
  if (sides.east) drawSideBands(scene, container, wx, wy, "east", alphas, liftPx);
  drawCornerPatches(scene, container, wx, wy, corners, aoCornerAlpha(strength), liftPx);
}
