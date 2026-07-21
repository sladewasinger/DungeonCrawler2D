// Renders subtleSlope.ts's shadow-line edges: a thin darker line on each side
// this tile sits shallowly below a neighbor — the Phaser side of the
// sub-integer height legibility fix.
import type Phaser from "phaser";
import { placeFractionalRect } from "./placeSprite.js";
import { subtleSlopeEdgesAt, type SlopeRead } from "./subtleSlope.js";

const LINE_COLOR = 0x000000;
const LINE_THICKNESS_FRAC = 0.09;
const BASE_ALPHA = 0.18;
const ALPHA_SPAN = 0.24;

export function drawSubtleSlope(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  world: SlopeRead,
  wx: number,
  wy: number,
  liftPx = 0,
): void {
  const edges = subtleSlopeEdgesAt(world, wx, wy);
  if (!edges.north && !edges.south && !edges.east && !edges.west) return;
  const alpha = BASE_ALPHA + ALPHA_SPAN * edges.strength;
  if (edges.north) {
    placeFractionalRect(scene, container, wx, wy, [0, 1], [0, LINE_THICKNESS_FRAC], LINE_COLOR, alpha, liftPx);
  }
  if (edges.south) {
    placeFractionalRect(scene, container, wx, wy, [0, 1], [1 - LINE_THICKNESS_FRAC, 1], LINE_COLOR, alpha, liftPx);
  }
  if (edges.west) {
    placeFractionalRect(scene, container, wx, wy, [0, LINE_THICKNESS_FRAC], [0, 1], LINE_COLOR, alpha, liftPx);
  }
  if (edges.east) {
    placeFractionalRect(scene, container, wx, wy, [1 - LINE_THICKNESS_FRAC, 1], [0, 1], LINE_COLOR, alpha, liftPx);
  }
}
