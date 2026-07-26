// LANE W3: click-painting on the RIGHT (rotated) render panel — pointer -> viewToWorld
// -> the correct WORLD cell, mirroring paintPanel/pointer.ts's DOM contract (drag-paint
// left button, right-click erase) but reading Phaser's camera-aware pointer.worldX/Y
// instead of a DOM canvas rect. Shares paintCell (paintAction.ts) so both panels apply
// identical brush/erase semantics, and the same inspector text (inspector.ts) so hovering
// either panel reports the same WORLD-space read (mask, height, stack) — only the
// highlight's own screen position differs, since it lives in view/screen space.
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { ownFaceRowAt } from "../../render/terrain/ownFace.js";
import { pitFaceRowAt } from "../../render/terrain/pitFace.js";
import { viewWorld } from "../../render/terrain/viewWorld.js";
import { getViewOrientation, pickTallestFirst, type ViewOrientation } from "../../render/view/index.js";
import type { EditorStore } from "./editorStore.js";
import { paintCell } from "./paintAction.js";
import { inspectorText, type InspectorFace } from "./paintPanel/inspector.js";

export interface HoveredCell {
  readonly vx: number; // view-space tile (the screen slot the pointer is over)
  readonly vy: number;
  readonly wx: number; // the WORLD cell that screen slot currently displays
  readonly wy: number;
  readonly face?: InspectorFace;
}

function projectedFaceAt(store: EditorStore, vx: number, vy: number, orientation: ViewOrientation): HoveredCell | null {
  const projectedWorld = viewWorld(store.world, orientation);
  const pitFace = pitFaceRowAt(projectedWorld, vx, vy);
  if (pitFace) {
    const owner = projectedWorld.toReal(vx, vy - pitFace.rimDistance);
    if (!store.world.inGrid(owner.x, owner.y)) return null;
    return {
      vx,
      vy,
      wx: owner.x,
      wy: owner.y,
      face: {
        rowFromTop: pitFace.rowFromTop,
        totalRows: pitFace.totalRows,
        surfaceHeight: pitFace.surfaceHeight,
      },
    };
  }

  const raisedFace = ownFaceRowAt(projectedWorld, vx, vy);
  const raw = projectedWorld.toReal(vx, vy);
  if (!store.world.inGrid(raw.x, raw.y)) return null;
  return {
    vx,
    vy,
    wx: raw.x,
    wy: raw.y,
    ...(raisedFace
      ? {
          face: {
            rowFromTop: raisedFace.rowFromTop,
            totalRows: raisedFace.distanceToGround + raisedFace.rowFromTop - 1,
            surfaceHeight: raisedFace.surfaceHeight,
          },
        }
      : {}),
  };
}

/** Screen (view-pixel) -> world tile at the CURRENT orientation, or null outside the
 * paintable grid. Pure aside from reading the live ViewOrientation, so a Phaser Pointer
 * is never required — any {worldX, worldY} pair works, easing unit testing.
 *
 * WAVE E3 (docs/ELEVATION-PROJECTION.md section 4): a raised cell's cap draws SHIFTED
 * screen-up from its own view row, so the flat `viewTileToWorld({vx,vy})` this used to
 * call would resolve to the wrong (flat-projected) cell wherever height is nonzero —
 * literally a different world tile, one row off per unit of height. `pickTallestFirst`
 * searches height candidates tallest-first and returns the cell that's ACTUALLY drawn
 * at this screen slot. The returned `vx`/`vy` stay the raw floored screen slot
 * unchanged (not the resolved cell's own unshifted home row) — that slot IS the
 * resolved cell's shifted position by construction (its home row minus its own height
 * equals back this slot), so `updatePreview` below already draws the highlight exactly
 * on the drawn cap with no separate shift math needed. */
export function hoveredCellAt(store: EditorStore, worldX: number, worldY: number): HoveredCell | null {
  const orientation = getViewOrientation();
  const vx = Math.floor(worldX / SCREEN_TILE_PX);
  const vy = Math.floor(worldY / SCREEN_TILE_PX);
  const pick = pickTallestFirst(vx, vy, orientation, (wx, wy) => store.world.heightAt(wx, wy));
  const pickedHeight = store.world.heightAt(pick.wx, pick.wy);
  if (pickedHeight === pick.height) {
    if (!store.world.inGrid(pick.wx, pick.wy)) return null;
    return { vx, vy, wx: pick.wx, wy: pick.wy };
  }
  return projectedFaceAt(store, vx, vy, orientation);
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
  hooks.setInspectorText(inspectorText(store, cell.wx, cell.wy, cell.face));
}

export function wireRenderPanelPointer(
  scene: Phaser.Scene,
  store: EditorStore,
  preview: Phaser.GameObjects.Rectangle,
  hooks: RenderPanelPointerHooks,
): void {
  scene.input.mouse?.disableContextMenu();

  scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
    const cell = hoveredCellAt(store, pointer.worldX, pointer.worldY);
    updatePreview(store, preview, hooks, cell);
  });
  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    const cell = hoveredCellAt(store, pointer.worldX, pointer.worldY);
    if (!cell) return;
    paintCell(store, cell.wx, cell.wy, pointer.rightButtonDown());
    hooks.refreshGrid();
  });
}
