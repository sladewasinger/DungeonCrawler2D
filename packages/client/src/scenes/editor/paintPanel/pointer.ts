// Pointer-driven terrain sculpting: one left click raises, one right click lowers.
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

export function wirePointerPainting(
  canvas: HTMLCanvasElement,
  store: EditorStore,
  inspector: HTMLElement,
  refresh: () => void,
): void {
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  canvas.addEventListener("pointerdown", (ev) => {
    const { x, y } = cellFromEvent(canvas, ev);
    paintCell(store, x, y, ev.button === 2);
    refresh();
  });
  canvas.addEventListener("pointermove", (ev) => {
    const { x, y } = cellFromEvent(canvas, ev);
    inspector.textContent = inspectorText(store, x, y);
  });
}
