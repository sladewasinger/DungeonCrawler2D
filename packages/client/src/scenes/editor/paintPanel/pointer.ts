// Pointer-driven painting: drag-paint with the left button, right-click erase. The
// actual brush/erase decision (erase targets the terrain eraser for terrain brushes, or
// the matching bench layer for bench brushes) lives in paintAction.ts, shared with the
// Phaser render panel (renderPanelPointer.ts, LANE W3) so both panels agree.
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";
import type { EditorStore } from "../editorStore.js";
import { paintCell } from "../paintAction.js";
import { inspectorText } from "./inspector.js";

function cellFromEvent(canvas: HTMLCanvasElement, ev: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((ev.clientX - rect.left) / rect.width) * EDITOR_GRID_SIZE),
    y: Math.floor(((ev.clientY - rect.top) / rect.height) * EDITOR_GRID_SIZE),
  };
}

/** Paints (or, for a bench/torch brush while erasing, un-paints) one cell and repaints the canvas. */
function makePaintAt(store: EditorStore, refresh: () => void, isErasing: () => boolean) {
  return (x: number, y: number): void => {
    paintCell(store, x, y, isErasing());
    refresh();
  };
}

export function wirePointerPainting(
  canvas: HTMLCanvasElement,
  store: EditorStore,
  inspector: HTMLElement,
  refresh: () => void,
): void {
  let painting = false;
  let erasing = false;
  const paintAt = makePaintAt(store, refresh, () => erasing);
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  canvas.addEventListener("pointerdown", (ev) => {
    painting = true;
    erasing = ev.button === 2;
    canvas.setPointerCapture(ev.pointerId);
    const { x, y } = cellFromEvent(canvas, ev);
    paintAt(x, y);
  });
  canvas.addEventListener("pointermove", (ev) => {
    const { x, y } = cellFromEvent(canvas, ev);
    inspector.textContent = inspectorText(store, x, y);
    if (painting) paintAt(x, y);
  });
  canvas.addEventListener("pointerup", () => (painting = false));
}
