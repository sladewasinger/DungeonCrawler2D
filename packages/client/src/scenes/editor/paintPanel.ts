// The editor's left panel: a paintable 20x20 DOM canvas plus brush palette,
// toggles, and the cursor inspector. Pure DOM — the Phaser side only re-renders.
import { TILE } from "@dc2d/engine";
import { ownFaceRowAt } from "../../render/terrain/ownFace.js";
import { EDITOR_GRID_SIZE } from "./EditableWorld.js";
import type { EditorStore } from "./editorStore.js";

const CELL_PX = 26;
const HEIGHT_BRUSHES = [-1, 0, 1, 2, 3, 4, 6, 8] as const;

const CELL_COLORS: Record<string, string> = { rock: "#6b6b7e", door: "#3dd6c3" };

function heightColor(h: number): string {
  if (h < 0) return "#101018";
  const t = Math.min(1, h / 8);
  const c = Math.round(46 + t * 120);
  return `rgb(${c},${c},${Math.round(58 + t * 120)})`;
}

function cellStyle(tile: number, height: number): { fill: string; label: string } {
  if (tile === TILE.Wall) return { fill: CELL_COLORS["rock"] ?? "#6b6b7e", label: `R${height}` };
  if (tile === TILE.DoorSafeRoom) return { fill: CELL_COLORS["door"] ?? "#3dd6c3", label: "D" };
  return { fill: heightColor(height), label: String(height) };
}

function drawGrid(canvas: HTMLCanvasElement, store: EditorStore): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let y = 0; y < EDITOR_GRID_SIZE; y++) {
    for (let x = 0; x < EDITOR_GRID_SIZE; x++) {
      const cell = store.world.cellAt(x, y);
      const { fill, label } = cellStyle(cell.tile, cell.height);
      ctx.fillStyle = fill;
      ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX - 1, CELL_PX - 1);
      ctx.fillStyle = cell.height >= 3 ? "#14141c" : "#c8c8d6";
      ctx.fillText(label, x * CELL_PX + CELL_PX / 2, y * CELL_PX + CELL_PX / 2);
    }
  }
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText =
    "background:#1a1a24;color:#d9d9e4;border:1px solid #494956;border-radius:4px;padding:4px 8px;cursor:pointer;font:12px monospace";
  b.addEventListener("click", onClick);
  return b;
}

function buildPalette(store: EditorStore, refresh: () => void): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin:8px 0";
  const select = (b: HTMLButtonElement) => {
    for (const el of bar.querySelectorAll("button")) (el as HTMLButtonElement).style.outline = "";
    b.style.outline = "2px solid #ffd23d";
  };
  for (const h of HEIGHT_BRUSHES) {
    const b = button(`z${h}`, () => ((store.brush = { kind: "height", value: h }), select(b)));
    if (h === 1) b.style.outline = "2px solid #ffd23d";
    bar.append(b);
  }
  const rock = button("rock", () => ((store.brush = { kind: "rock" }), select(rock)));
  const door = button("door", () => ((store.brush = { kind: "door" }), select(door)));
  bar.append(rock, door);
  bar.append(button("collision", () => store.toggleCollision()));
  bar.append(button("reset", () => (store.reset(), refresh())));
  bar.append(
    button("import", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (file) store.importJson(await file.text());
        refresh();
      });
      input.click();
    }),
    button("export", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([store.exportJson()], { type: "application/json" }));
      a.download = "dc2d-editor-map.json";
      a.click();
    }),
  );
  return bar;
}

function inspectorText(store: EditorStore, x: number, y: number): string {
  const cell = store.world.cellAt(x, y);
  const face = ownFaceRowAt(store.world, x, y);
  const tileName = cell.tile === TILE.Wall ? "rock" : cell.tile === TILE.DoorSafeRoom ? "door" : "floor";
  const faceText = face
    ? ` | face row ${face.rowFromTop}/${face.distanceToGround + face.rowFromTop - 1} of z${face.surfaceHeight}`
    : store.world.isWalkable(x, y)
      ? " | walkable"
      : " | blocked";
  return `(${x},${y}) ${tileName} z=${cell.height}${faceText}`;
}

function wirePointerPainting(
  canvas: HTMLCanvasElement,
  store: EditorStore,
  inspector: HTMLElement,
  refresh: () => void,
): void {
  const cellFromEvent = (ev: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((ev.clientX - rect.left) / rect.width) * EDITOR_GRID_SIZE),
      y: Math.floor(((ev.clientY - rect.top) / rect.height) * EDITOR_GRID_SIZE),
    };
  };
  let painting = false;
  let erasing = false;
  const paintAt = (x: number, y: number): void => {
    const active = store.brush;
    if (erasing) store.brush = { kind: "erase" };
    store.paint(x, y);
    store.brush = active;
    refresh();
  };
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  canvas.addEventListener("pointerdown", (ev) => {
    painting = true;
    erasing = ev.button === 2;
    canvas.setPointerCapture(ev.pointerId);
    const { x, y } = cellFromEvent(ev);
    paintAt(x, y);
  });
  canvas.addEventListener("pointermove", (ev) => {
    const { x, y } = cellFromEvent(ev);
    inspector.textContent = inspectorText(store, x, y);
    if (painting) paintAt(x, y);
  });
  canvas.addEventListener("pointerup", () => (painting = false));
}

/** Builds the whole left panel into `parent`; returns the repaint hook. */
export function buildPaintPanel(parent: HTMLElement, store: EditorStore): () => void {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = EDITOR_GRID_SIZE * CELL_PX;
  canvas.style.cssText = "border:1px solid #494956;cursor:crosshair;touch-action:none";
  const inspector = document.createElement("div");
  inspector.style.cssText = "font:12px monospace;color:#8f8fa3;min-height:18px;margin-top:6px";
  inspector.textContent = "hover a cell";
  const refresh = () => drawGrid(canvas, store);
  wirePointerPainting(canvas, store, inspector, refresh);
  parent.append(buildPalette(store, refresh), canvas, inspector);
  refresh();
  return refresh;
}
