// Shared paint-or-erase decision for one cell — the exact brush/erase vocabulary,
// factored out so the DOM data grid (paintPanel/pointer.ts) and the Phaser render panel
// (renderPanelPointer.ts, LANE W3) apply IDENTICAL semantics. Both panels paint the same
// EditorStore; this is the one place that decides what a click does to a cell.
import type { EditorStore } from "./editorStore.js";

const isBenchBrush = (store: EditorStore): boolean =>
  store.brush.kind === "area" || store.brush.kind === "spawn-enemy" || store.brush.kind === "spawn-item";

const isTorchBrush = (store: EditorStore): boolean => store.brush.kind === "torch";
const isVoidBrush = (store: EditorStore): boolean => store.brush.kind === "void";

function handleStairClick(
  store: EditorStore,
  x: number,
  y: number,
  erasing: boolean,
): boolean {
  if (store.brush.kind !== "stairs") return false;
  if (erasing) store.cancelStairPlacement();
  else store.selectStairCell(x, y);
  return true;
}

function eraseSpecialBrush(store: EditorStore, x: number, y: number): boolean {
  if (isBenchBrush(store)) store.eraseBenchAt(x, y);
  else if (isTorchBrush(store)) store.eraseTorchAt(x, y);
  else return false;
  return true;
}

/** Raises a terrain cell with left-click and lowers it with right-click. Bench and
 * torch brushes retain their own erase behavior for the legacy effect workbench. */
export function paintCell(store: EditorStore, x: number, y: number, erasing: boolean): void {
  if (handleStairClick(store, x, y, erasing)) return;
  if (erasing && eraseSpecialBrush(store, x, y)) return;
  if (isVoidBrush(store)) {
    if (erasing) store.restoreVoidAt(x, y);
    else store.paint(x, y);
    return;
  }
  if (store.brush.kind === "reset-to-zero") {
    store.paint(x, y);
    return;
  }
  if (!isBenchBrush(store) && !isTorchBrush(store)) store.adjustFloorHeight(x, y, erasing ? -1 : 1);
  else store.paint(x, y);
}
