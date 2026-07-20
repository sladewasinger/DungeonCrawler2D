// Headless tests for edit-HUD's grid-snap + anchor-recompute math — no Phaser/DOM.
import { describe, expect, it } from "vitest";
import { EDIT_GRID_SIZE, recomputeAnchor, snapToGrid, toStoredOffset } from "./snap.js";

const VIEWPORT = { width: 1200, height: 900 };

describe("snapToGrid", () => {
  it("rounds to the nearest multiple of EDIT_GRID_SIZE", () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(3)).toBe(0);
    expect(snapToGrid(5)).toBe(EDIT_GRID_SIZE);
    expect(snapToGrid(-5)).toBe(-EDIT_GRID_SIZE);
    expect(snapToGrid(11)).toBe(EDIT_GRID_SIZE);
    expect(snapToGrid(13)).toBe(EDIT_GRID_SIZE * 2);
  });

  it("normalizes a -0 result (e.g. snapping -1) to plain 0", () => {
    expect(Object.is(snapToGrid(-1), 0)).toBe(true);
  });
});

describe("recomputeAnchor", () => {
  it("picks top-left for a point in the top-left ninth of the screen", () => {
    const { anchor, offset } = recomputeAnchor({ x: 50, y: 40 }, VIEWPORT);
    expect(anchor).toBe("top-left");
    expect(offset).toEqual({ x: 48, y: 40 });
  });

  it("picks bottom-right for a point in the bottom-right ninth", () => {
    const { anchor, offset } = recomputeAnchor({ x: 1150, y: 860 }, VIEWPORT);
    expect(anchor).toBe("bottom-right");
    // bottom-right's base point is (1200, 900); offset is negative, snapped to the grid.
    expect(offset).toEqual({ x: -48, y: -40 });
  });

  it("collapses center-vertical + center-horizontal to bare 'center', not 'center-center'", () => {
    const { anchor } = recomputeAnchor({ x: 600, y: 450 }, VIEWPORT);
    expect(anchor).toBe("center");
  });

  it("picks top-center for a point centered horizontally but near the top edge", () => {
    const { anchor } = recomputeAnchor({ x: 600, y: 10 }, VIEWPORT);
    expect(anchor).toBe("top-center");
  });

  it("picks center-left for a point centered vertically but near the left edge", () => {
    const { anchor } = recomputeAnchor({ x: 5, y: 450 }, VIEWPORT);
    expect(anchor).toBe("center-left");
  });

  it("always returns a grid-aligned offset even for an unaligned input point", () => {
    const { offset } = recomputeAnchor({ x: 601, y: 449 }, VIEWPORT);
    expect(offset.x % EDIT_GRID_SIZE).toBe(0);
    expect(offset.y % EDIT_GRID_SIZE).toBe(0);
  });

  it("degrades to 'center' rather than dividing by zero on an empty viewport", () => {
    const { anchor } = recomputeAnchor({ x: 0, y: 0 }, { width: 0, height: 0 });
    expect(anchor).toBe("center");
  });
});

describe("toStoredOffset", () => {
  it("divides a real on-screen offset by hudScale so resolveLayout's own multiply reproduces it exactly", () => {
    expect(toStoredOffset({ x: -128, y: 64 }, 2)).toEqual({ x: -64, y: 32 });
  });

  it("is a no-op at hudScale 1", () => {
    expect(toStoredOffset({ x: 40, y: -24 }, 1)).toEqual({ x: 40, y: -24 });
  });

  it("round-trips through resolveLayout's own offset * hudScale multiply", () => {
    const hudScale = 2;
    const dragged = recomputeAnchor({ x: 640, y: 592 }, { width: 1280, height: 720 });
    const stored = toStoredOffset(dragged.offset, hudScale);
    const resolvedAgain = { x: stored.x * hudScale, y: stored.y * hudScale };
    expect(resolvedAgain).toEqual(dragged.offset);
  });
});
