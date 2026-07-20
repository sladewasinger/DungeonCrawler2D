// The connectivity gallery's fixed test map: one labeled 6x5 slot per autotile case,
// laid out in a 3-column x 4-row meta-grid over the editor's 20x20 EditableWorld
// (3 cols x 6 wide = 18 <= 20, 4 rows x 5 tall = 20 exactly). Every slot's wall
// pattern is anchored at local (2, 2) unless the fixture specifically needs the
// grid's real edge (the "map edge" case), so eyeballing any slot in isolation
// is enough to verify that one case.
import type { EditableWorld } from "../editor/EditableWorld.js";

const SLOT_W = 6;
const SLOT_H = 5;
const COLS = 3;

export interface GalleryFixture {
  readonly label: string;
  /** Paints this fixture's walls at (originX, originY)-relative local coordinates. */
  readonly paint: (world: EditableWorld, originX: number, originY: number) => void;
}

function wallsAt(world: EditableWorld, ox: number, oy: number, offsets: ReadonlyArray<readonly [number, number]>): void {
  for (const [dx, dy] of offsets) world.paintWallAt(ox + dx, oy + dy);
}

export const GALLERY_FIXTURES: readonly GalleryFixture[] = [
  {
    label: "single wall",
    paint: (w, ox, oy) => wallsAt(w, ox, oy, [[2, 2]]),
  },
  {
    label: "straight run (E-W)",
    paint: (w, ox, oy) => wallsAt(w, ox, oy, [[1, 2], [2, 2], [3, 2]]),
  },
  {
    label: "straight run (N-S)",
    paint: (w, ox, oy) => wallsAt(w, ox, oy, [[2, 1], [2, 2], [2, 3]]),
  },
  {
    label: "L junction",
    paint: (w, ox, oy) => wallsAt(w, ox, oy, [[2, 2], [3, 2], [2, 1]]),
  },
  {
    label: "T junction",
    paint: (w, ox, oy) => wallsAt(w, ox, oy, [[2, 2], [1, 2], [3, 2], [2, 1]]),
  },
  {
    label: "X junction",
    paint: (w, ox, oy) => wallsAt(w, ox, oy, [[2, 2], [1, 2], [3, 2], [2, 1], [2, 3]]),
  },
  {
    label: "2x2 block",
    paint: (w, ox, oy) => wallsAt(w, ox, oy, [[1, 1], [2, 1], [1, 2], [2, 2]]),
  },
  {
    label: "3x3 block, hole",
    paint: (w, ox, oy) =>
      wallsAt(w, ox, oy, [
        [1, 1], [2, 1], [3, 1],
        [1, 2],         [3, 2], // center (2,2) stays floor: the hole
        [1, 3], [2, 3], [3, 3],
      ]), // prettier-ignore
  },
  {
    label: "diagonal-only touch",
    paint: (w, ox, oy) => wallsAt(w, ox, oy, [[1, 1], [2, 2]]),
  },
  {
    label: "map edge",
    // Anchored at the grid's real x=0 boundary, ignoring the slot's own local
    // (2,2) convention — its west neighbor is genuinely off-grid, not "same
    // material," so it must border exactly like any other open side.
    paint: (w, _ox, oy) => wallsAt(w, 0, oy, [[0, 2]]),
  },
];

/** World-space top-left of meta-grid slot `index` (row-major, COLS per row). */
export function slotOrigin(index: number): { readonly x: number; readonly y: number } {
  return { x: (index % COLS) * SLOT_W, y: Math.floor(index / COLS) * SLOT_H };
}

/** Paints every fixture into `world` at its own meta-grid slot. */
export function paintGallery(world: EditableWorld): void {
  GALLERY_FIXTURES.forEach((fixture, i) => {
    const { x, y } = slotOrigin(i);
    fixture.paint(world, x, y);
  });
}
