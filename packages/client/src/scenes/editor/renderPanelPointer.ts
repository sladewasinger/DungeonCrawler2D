// LANE W3: click-painting on the RIGHT (rotated) render panel — pointer -> viewToWorld
// -> the correct WORLD cell, mirroring paintPanel/pointer.ts's DOM contract (drag-paint
// left button, right-click erase) but reading Phaser's camera-aware pointer.worldX/Y
// instead of a DOM canvas rect. Shares paintCell (paintAction.ts) so both panels apply
// identical brush/erase semantics, and the same inspector text (inspector.ts) so hovering
// either panel reports the same WORLD-space read (mask, height, stack) — only the
// highlight's own screen position differs, since it lives in view/screen space.
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { getViewOrientation, viewTileToWorld } from "../../render/view/index.js";
import type { EditorStore } from "./editorStore.js";
import { paintCell } from "./paintAction.js";
import { inspectorText } from "./paintPanel/inspector.js";

interface HoveredCell {
  readonly vx: number; // view-space tile (the screen slot the pointer is over)
  readonly vy: number;
  readonly wx: number; // the WORLD cell that screen slot currently displays
  readonly wy: number;
}

/** Screen (view-pixel) -> world tile at the CURRENT orientation, or null outside the
 * paintable grid. Pure aside from reading the live ViewOrientation, so a Phaser Pointer
 * is never required — any {worldX, worldY} pair works, easing unit testing. */
export function hoveredCellAt(store: EditorStore, worldX: number, worldY: number): HoveredCell | null {
  const orientation = getViewOrientation();
  const vx = Math.floor(worldX / SCREEN_TILE_PX);
  const vy = Math.floor(worldY / SCREEN_TILE_PX);
  // Tile-index mapping (floored cell -> world cell), which agrees with flooring the
  // continuous transform of the raw pointer — the view cell you hover IS the world
  // cell you paint, matching where the terrain grid actually draws it.
  const world = viewTileToWorld({ x: vx, y: vy }, orientation);
  if (!store.world.inGrid(world.x, world.y)) return null;
  return { vx, vy, wx: world.x, wy: world.y };
}

export interface RenderPanelPointerHooks {
  readonly refreshGrid: () => void;
  readonly setInspectorText: (text: string) => void;
}

/** Positions/shows the paint-preview rectangle over `cell`, or hides it — the brush
 * footprint tracking requirement: it lives in view/screen space (the pointer's own
 * space), so no rotation math is needed here beyond hoveredCellAt's own conversion. */
function updatePreview(store: EditorStore, preview: Phaser.GameObjects.Rectangle, hooks: RenderPanelPointerHooks, cell: HoveredCell | null): void {
  if (!cell) {
    preview.setVisible(false);
    hooks.setInspectorText("hover a cell");
    return;
  }
  preview.setPosition(cell.vx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2, cell.vy * SCREEN_TILE_PX + SCREEN_TILE_PX / 2);
  preview.setVisible(true);
  hooks.setInspectorText(inspectorText(store, cell.wx, cell.wy));
}

export function wireRenderPanelPointer(
  scene: Phaser.Scene,
  store: EditorStore,
  preview: Phaser.GameObjects.Rectangle,
  hooks: RenderPanelPointerHooks,
): void {
  let painting = false;
  let erasing = false;
  scene.input.mouse?.disableContextMenu();

  scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
    const cell = hoveredCellAt(store, pointer.worldX, pointer.worldY);
    updatePreview(store, preview, hooks, cell);
    if (painting && cell) {
      paintCell(store, cell.wx, cell.wy, erasing);
      hooks.refreshGrid();
    }
  });
  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    const cell = hoveredCellAt(store, pointer.worldX, pointer.worldY);
    if (!cell) return;
    painting = true;
    erasing = pointer.rightButtonDown();
    paintCell(store, cell.wx, cell.wy, erasing);
    hooks.refreshGrid();
  });
  scene.input.on("pointerup", () => (painting = false));
}
