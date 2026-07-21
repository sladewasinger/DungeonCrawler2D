// Shared paint-or-erase decision for one cell — the exact brush/erase vocabulary,
// factored out so the DOM data grid (paintPanel/pointer.ts) and the Phaser render panel
// (renderPanelPointer.ts, LANE W3) apply IDENTICAL semantics. Both panels paint the same
// EditorStore; this is the one place that decides what a click does to a cell.
import type { EditorStore } from "./editorStore.js";

const isBenchBrush = (store: EditorStore): boolean =>
  store.brush.kind === "area" || store.brush.kind === "spawn-enemy" || store.brush.kind === "spawn-item";

const isTorchBrush = (store: EditorStore): boolean => store.brush.kind === "torch";
const isVoidBrush = (store: EditorStore): boolean => store.brush.kind === "void";

/** Raises a terrain cell with left-click and lowers it with right-click. Bench and
 * torch brushes retain their own erase behavior for the legacy effect workbench. */
export function paintCell(store: EditorStore, x: number, y: number, erasing: boolean): void {
  if (erasing && isBenchBrush(store)) {
    store.eraseBenchAt(x, y);
    return;
  }
  if (erasing && isTorchBrush(store)) {
    store.eraseTorchAt(x, y);
    return;
  }
  if (isVoidBrush(store)) {
    if (erasing) store.restoreVoidAt(x, y);
    else store.paint(x, y);
    return;
  }
  if (!isBenchBrush(store) && !isTorchBrush(store)) store.adjustFloorHeight(x, y, erasing ? -1 : 1);
  else store.paint(x, y);
}
