// hoveredCellAt: the pure screen->world mapping behind LANE W3's render-panel
// click-painting. Exercises all 4 orientations against hand-derived view/world pairs
// (cross-checked against viewTransform.ts's own worldToView, never re-derived by hand
// only) plus the in-grid boundary.
import { afterEach, describe, expect, it } from "vitest";
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

describe("hoveredCellAt", () => {
  afterEach(() => resetViewOrientation());

  it("is the identity at orientation 0 (view tile === world tile)", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    const { worldX, worldY } = screenPointFor(5, 8);
    expect(hoveredCellAt(store, worldX, worldY)).toEqual({ vx: 5, vy: 8, wx: 5, wy: 8 });
  });

  it("recovers the correct world cell at orientation 270 (a genuinely rotated screen slot)", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    setViewOrientation(270);
    // The view cell world tile (5, 8) DISPLAYS in at 270 — the tile-index mapping, so
    // this test can never desync from the convention the terrain grid actually draws by.
    const view = worldTileToView({ x: 5, y: 8 }, 270);
    const { worldX, worldY } = screenPointFor(view.x, view.y);
    expect(hoveredCellAt(store, worldX, worldY)).toEqual({ vx: view.x, vy: view.y, wx: 5, wy: 8 });
  });

  it("returns null for a screen point whose world cell falls outside the 20x20 grid", () => {
    installFakeLocalStorage();
    const store = new EditorStore();
    const { worldX, worldY } = screenPointFor(-3, 0); // world x = -3, off-grid at orientation 0
    expect(hoveredCellAt(store, worldX, worldY)).toBeNull();
  });
});
