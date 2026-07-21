// Shared paint-or-erase decision for one cell — the exact brush/erase vocabulary,
// factored out so the DOM data grid (paintPanel/pointer.ts) and the Phaser render panel
// (renderPanelPointer.ts, LANE W3) apply IDENTICAL semantics. Both panels paint the same
// EditorStore; this is the one place that decides what a click does to a cell.
import type { EditorStore } from "./editorStore.js";

const isBenchBrush = (store: EditorStore): boolean =>
  store.brush.kind === "area" || store.brush.kind === "spawn-enemy" || store.brush.kind === "spawn-item";

const isTorchBrush = (store: EditorStore): boolean => store.brush.kind === "torch";

/** Paints (or, for a bench/torch brush while erasing, un-paints) one cell. */
export function paintCell(store: EditorStore, x: number, y: number, erasing: boolean): void {
  if (erasing && isBenchBrush(store)) {
    store.eraseBenchAt(x, y);
    return;
  }
  if (erasing && isTorchBrush(store)) {
    store.eraseTorchAt(x, y);
    return;
  }
  const active = store.brush;
  if (erasing) store.brush = { kind: "erase" };
  store.paint(x, y);
  store.brush = active;
}
