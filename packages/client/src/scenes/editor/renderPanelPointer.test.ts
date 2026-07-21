// hoveredCellAt: the pure screen->world mapping behind LANE W3's render-panel
// click-painting. Exercises all 4 orientations against hand-derived view/world pairs
// (cross-checked against viewTransform.ts's own worldToView, never re-derived by hand
// only) plus the in-grid boundary.
import { afterEach, describe, expect, it } from "vitest";
import { TILE } from "@dc2d/engine";
import { resetViewOrientation, setViewOrientation, worldTileToView } from "../../render/view/index.js";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { EditorStore } from "./editorStore.js";
import { hoveredCellAt } from "./renderPanelPointer.js";

function installFakeLocalStorage(): void {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value),
    removeItem: (key: string) => void backing.delete(key),
    clear: () => backing.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

/** A screen point guaranteed to land inside tile (vx, vy) — offset well clear of any tile edge. */
function screenPointFor(vx: number, vy: number): { worldX: number; worldY: number } {
  return { worldX: vx * SCREEN_TILE_PX + 10, worldY: vy * SCREEN_TILE_PX + 10 };
}

function stampRaisedCell(store: EditorStore): void {
  store.world.setCell(5, 5, TILE.Floor, 3);
}

// (19, 19) sits outside every rect seedDemoPattern.ts paints (its rects top out at
// x<=17, y<=18ish) — genuinely flat (height 0), so these two tests exercise pure
// screen<->world orientation mapping with no height search ever finding a taller
// claimant (both cells this picks between coincide: it's a REAL identity check).
describe("hoveredCellAt", () => {
  afterEach(() => resetViewOrientation());

  it("is the identity at orientation 0 (view tile === world tile) on flat ground", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    const { worldX, worldY } = screenPointFor(19, 19);
    expect(hoveredCellAt(store, worldX, worldY)).toEqual({ vx: 19, vy: 19, wx: 19, wy: 19 });
  });

  it("recovers the correct world cell at orientation 270 on flat ground (a genuinely rotated screen slot)", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    setViewOrientation(270);
    // The view cell world tile (19, 19) DISPLAYS in at 270 — the tile-index mapping, so
    // this test can never desync from the convention the terrain grid actually draws by.
    const view = worldTileToView({ x: 19, y: 19 }, 270);
    const { worldX, worldY } = screenPointFor(view.x, view.y);
    expect(hoveredCellAt(store, worldX, worldY)).toEqual({ vx: view.x, vy: view.y, wx: 19, wy: 19 });
  });

  it("returns null for a screen point whose world cell falls outside the 20x20 grid", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    const { worldX, worldY } = screenPointFor(-3, 0); // world x = -3, off-grid at orientation 0
    expect(hoveredCellAt(store, worldX, worldY)).toBeNull();
  });

  // WAVE E3 (docs/ELEVATION-PROJECTION.md section 4): seedDemoPattern.ts stacks world
  // cell (5, 5) to height 3 (rect1's 1 layer + rect2's 2 more, both covering it) with a
  // lower neighbor at (5, 6) (rect1 only, height 1) — its cap draws SHIFTED screen-up
  // by 3 rows from its own home row, so the flat pre-E3 mapping would have resolved a
  // click there to the WRONG (lower, or off-platform) cell. Expected screen slots are
  // hand-derived from worldTileToView + the shift formula, not from hoveredCellAt itself.
  it("resolves a click on the raised cap's SHIFTED screen slot to the real elevated cell, orientation 0", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    stampRaisedCell(store);
    // home view row of (5,5) at orientation 0 is 5 (identity); shifted screen row = 5 - 3 = 2.
    const { worldX, worldY } = screenPointFor(5, 2);
    expect(hoveredCellAt(store, worldX, worldY)).toEqual({ vx: 5, vy: 2, wx: 5, wy: 5 });
  });

  it("resolves a click on the raised cap's SHIFTED screen slot to the real elevated cell, orientation 180 (acceptance shot)", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    stampRaisedCell(store);
    setViewOrientation(180);
    // worldTileToView({5,5}, 180) = (-6, -6); shifted screen row = -6 - 3 = -9.
    const home = worldTileToView({ x: 5, y: 5 }, 180);
    const { worldX, worldY } = screenPointFor(home.x, home.y - 3);
    expect(hoveredCellAt(store, worldX, worldY)).toEqual({ vx: home.x, vy: home.y - 3, wx: 5, wy: 5 });
  });
});
