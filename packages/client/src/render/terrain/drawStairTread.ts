// Renders one stair (or RUN_PADDING) tile's tread risers — the Phaser side of
// stairTread.ts's pure geometry: thin translucent lines perpendicular to the
// climb direction, so a single physical Stairs tile (or the flat-looking
// padding beside one) reads as several stacked steps instead of one blob.
import type Phaser from "phaser";
import { multiplyTint } from "./heightShade.js";
import { placeFractionalRect } from "./placeSprite.js";
import { stacksVertically, treadRisers } from "./stairTread.js";

const RISER_COLOR = 0xffffff;
const RISER_THICKNESS_FRAC = 0.05;
const RISER_BASE_ALPHA = 0.14;
const RISER_ALPHA_SPAN = 0.28;

export function drawStairTreads(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  wx: number,
  wy: number,
  direction: number,
  t: number,
  lightTint: number,
): void {
  const vertical = stacksVertically(direction);
  const color = multiplyTint(RISER_COLOR, lightTint);
  const half = RISER_THICKNESS_FRAC / 2;
  for (const riser of treadRisers(direction, t)) {
    const alpha = RISER_BASE_ALPHA + RISER_ALPHA_SPAN * riser.brightness;
    const band: [number, number] = [riser.axisFrac - half, riser.axisFrac + half];
    if (vertical) placeFractionalRect(scene, container, wx, wy, [0, 1], band, color, alpha);
    else placeFractionalRect(scene, container, wx, wy, band, [0, 1], color, alpha);
  }
}
