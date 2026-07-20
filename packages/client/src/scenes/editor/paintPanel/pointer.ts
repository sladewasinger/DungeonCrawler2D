// Pointer-driven painting: drag-paint with the left button, right-click erase. Erasing
// targets the terrain eraser brush for terrain brushes, or the matching bench layer
// (area/enemy/item) for bench brushes via editorStore.eraseBenchAt.
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";
import type { EditorStore } from "../editorStore.js";
import { inspectorText } from "./inspector.js";

const isBenchBrush = (store: EditorStore): boolean =>
  store.brush.kind === "area" || store.brush.kind === "spawn-enemy" || store.brush.kind === "spawn-item";

const isTorchBrush = (store: EditorStore): boolean => store.brush.kind === "torch";

function cellFromEvent(canvas: HTMLCanvasElement, ev: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((ev.clientX - rect.left) / rect.width) * EDITOR_GRID_SIZE),
    y: Math.floor(((ev.clientY - rect.top) / rect.height) * EDITOR_GRID_SIZE),
  };
}

/** Paints (or, for a bench brush while erasing, un-paints) one cell and repaints the canvas. */
function makePaintAt(store: EditorStore, refresh: () => void, isErasing: () => boolean) {
  return (x: number, y: number): void => {
    if (isErasing() && isBenchBrush(store)) {
      store.eraseBenchAt(x, y);
      refresh();
      return;
    }
    if (isErasing() && isTorchBrush(store)) {
      store.eraseTorchAt(x, y);
      refresh();
      return;
    }
    const active = store.brush;
    if (isErasing()) store.brush = { kind: "erase" };
    store.paint(x, y);
    store.brush = active;
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
