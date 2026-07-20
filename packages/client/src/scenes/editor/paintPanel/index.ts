// The editor's left panel: a paintable 20x20 DOM canvas plus the terrain and bench
// (Epic 7.11 EFFECTS/SPAWN) brush palettes, and the cursor inspector. Pure DOM — the
// Phaser side only re-renders. Consumers import this facade, never the siblings.
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";
import type { EditorStore } from "../editorStore.js";
import { buildBenchPalette } from "./benchPalette.js";
import { CELL_PX, drawGrid } from "./grid.js";
import { buildLightingPanel } from "./lightingPanel.js";
import { wirePointerPainting } from "./pointer.js";
import { buildTerrainPalette } from "./terrainPalette.js";

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
  parent.append(
    buildTerrainPalette(store, refresh),
    buildBenchPalette(store, refresh),
    buildLightingPanel(store),
    canvas,
    inspector,
  );
  refresh();
  return refresh;
}
