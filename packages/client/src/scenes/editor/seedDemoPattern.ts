// First-launch showcase, in the explicit-heights reskin's floor/wall/stairs
// vocabulary: stepped wall-stack terraces with floor caps, a safe room done RIGHT
// this time (z2 perimeter walls, corners closed — the known user gripe with the old
// solid-block room), and a 2-wide staircase climbing to a z4 landing. Stair tiles
// carry no authored height themselves (@dc2d/engine's compile interpolates a run
// between its flanking anchors), so this only has to place real floor/wall anchors
// at both ends of each run — order doesn't matter, compile resolves it globally.
import type { StackDir } from "@dc2d/engine";
import type { EditableWorld } from "./EditableWorld.js";

const NORTH: StackDir = 0;

/** Wall-stacks then floor-caps every cell in the rect — a solid raised platform. */
function stackAndCapRect(
  world: EditableWorld,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  layers: number,
  capId: string,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      for (let i = 0; i < layers; i++) world.paintWallAt(x, y);
      world.paintFloorAt(x, y, capId);
    }
  }
}

/** Perimeter walls (corners included — closed, not skipped) stacked to `layers`.
 * Interior cells are left untouched (bare ground). */
function wallPerimeter(world: EditableWorld, x0: number, y0: number, x1: number, y1: number, layers: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      for (let i = 0; i < layers; i++) world.paintWallAt(x, y);
    }
  }
}

/** A `width`-wide north-climbing staircase between a ground-level south anchor and a
 * `topLayers`-high capped north landing — compile interpolates each column's run. */
function stampStaircase(
  world: EditableWorld,
  x0: number,
  width: number,
  yBottom: number,
  steps: number,
  topLayers: number,
  capId: string,
): void {
  for (let dx = 0; dx < width; dx++) {
    world.paintFloorAt(x0 + dx, yBottom + 1, capId); // south (downhill) anchor, ground level
    for (let step = 0; step < steps; step++) world.paintStairsAt(x0 + dx, yBottom - step, NORTH);
    for (let i = 0; i < topLayers; i++) world.paintWallAt(x0 + dx, yBottom - steps);
    world.paintFloorAt(x0 + dx, yBottom - steps, capId); // north (uphill) landing anchor
  }
}

export function seedDemoPattern(world: EditableWorld): void {
  // Stepped terraces: wall stacks capped with a real pack floor variant at each tier.
  stackAndCapRect(world, 2, 3, 7, 8, 1, "medieval-sewer:1");
  stackAndCapRect(world, 4, 3, 7, 5, 2, "medieval-sewer:2");
  stackAndCapRect(world, 10, 3, 12, 5, 2, "dragon-cave:0");
  stackAndCapRect(world, 15, 3, 17, 5, 4, "dragon-cave:4");

  // Safe room done RIGHT: z2 perimeter, corners closed, one door punched south.
  wallPerimeter(world, 11, 11, 17, 16, 2);
  world.paintDoorAt(14, 16);

  // A 2-wide staircase climbing north to a z4 landing (rows 18..15; ground anchor at
  // 19, landing anchor at 14 — both need to stay inside the 20x20 grid).
  stampStaircase(world, 1, 2, 18, 4, 4, "medieval-sewer:0");
}
