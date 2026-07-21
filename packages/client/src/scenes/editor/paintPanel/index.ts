// The editor's left panel: a paintable 20x20 DOM canvas plus the terrain and bench
// (Epic 7.11 EFFECTS/SPAWN) brush palettes, and the cursor inspector. Pure DOM — the
// Phaser side only re-renders. Consumers import this facade, never the siblings.
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";
import type { EditorStore } from "../editorStore.js";
import { buildBenchPalette } from "./benchPalette.js";
import { CELL_PX, drawGrid } from "./grid.js";
import { buildLightingPanel } from "./lightingPanel.js";
import { buildTerrainPalette } from "./palette/index.js";
import { wirePointerPainting } from "./pointer.js";
import { buildViewSection } from "./viewSection.js";

export interface PaintPanelHandle {
  /** Redraws the north-fixed data grid canvas. */
  readonly refresh: () => void;
  /** LANE W3: lets the (rotated) render panel share this SAME readout when the user
   * hovers it, so either panel reports the identical WORLD-space inspector text. */
  readonly setInspectorText: (text: string) => void;
}

/** Builds the whole left panel into `parent`; returns its repaint/inspector hooks. */
export function buildPaintPanel(parent: HTMLElement, store: EditorStore): PaintPanelHandle {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = EDITOR_GRID_SIZE * CELL_PX;
  canvas.style.cssText = "border:1px solid #494956;cursor:crosshair;touch-action:none";
  const inspector = document.createElement("div");
  inspector.style.cssText = "font:12px monospace;color:#8f8fa3;min-height:18px;margin-top:6px";
  inspector.textContent = "hover a cell";
  const refresh = () => drawGrid(canvas, store);
  const setInspectorText = (text: string): void => {
    inspector.textContent = text;
  };
  wirePointerPainting(canvas, store, inspector, refresh);
  parent.append(
    buildViewSection(store),
    buildTerrainPalette(store, refresh),
    buildBenchPalette(store, refresh),
    buildLightingPanel(store),
    canvas,
    inspector,
  );
  refresh();
  return { refresh, setInspectorText };
}
