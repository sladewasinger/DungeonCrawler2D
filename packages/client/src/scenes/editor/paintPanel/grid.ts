// The left panel's 20x20 canvas: terrain cell fills/labels (reading @dc2d/engine's
// StackTile fields directly for the stack-count badge and cap/stair/door glyphs), plus
// small bench overlay glyphs (Epic 7.11) so painted areas/enemies/items are visible
// without switching to the right (real-renderer) panel.
import { TILE, type StackDir, type StackTile } from "@dc2d/engine";
import { maskHex } from "../../../render/terrain/autotile.js";
import type { BenchState } from "../bench/index.js";
import type { EditableWorld, EditorCell } from "../EditableWorld.js";
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";
import type { EditorStore } from "../editorStore.js";

export const CELL_PX = 26;

const AREA_DOT_COLORS: Record<string, string> = {
  "area-fire": "#ff9e3d",
  "area-poison": "#7bd44a",
  "area-oil": "#8a6d3b",
  "area-wet": "#3d9fff",
  "area-steam": "#d8dde6",
};
const STAIR_ARROW: Readonly<Record<StackDir, string>> = { 0: "↑", 1: "→", 2: "↓", 3: "←" };

function heightColor(h: number): string {
  if (h < 0) return "#101018";
  const t = Math.min(1, h / 8);
  const c = Math.round(46 + t * 120);
  return `rgb(${c},${c},${Math.round(58 + t * 120)})`;
}

/** Fill + label for one cell: an uncapped wall stack shows its layer-count badge
 * ("W2"), a stair shows a direction arrow, a door shows "D"; everything else (bare
 * ground or a capped platform) shows its compiled height, same as the pre-reskin grid. */
function cellStyle(stack: StackTile, cell: EditorCell): { fill: string; label: string } {
  if (stack.stair) return { fill: heightColor(cell.height), label: STAIR_ARROW[stack.stair.dir] };
  if (stack.feature) return { fill: "#3dd6c3", label: "D" };
  if (stack.cap === null && stack.walls > 0) return { fill: "#6b6b7e", label: `W${stack.walls}` };
  return { fill: heightColor(cell.height), label: String(cell.height) };
}

/** A small flame glyph (bottom-right) marking a stamped torch — the editor's own light
 * source, distinct from the area dot / spawn chip corners drawBenchOverlay uses. */
function drawTorchMarker(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#ffb300";
  ctx.beginPath();
  ctx.arc(x * CELL_PX + CELL_PX - 6, y * CELL_PX + CELL_PX - 6, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** A small dot for a painted area tile (top-left) and a chip for an enemy/item spawn (top-right). */
function drawBenchOverlay(ctx: CanvasRenderingContext2D, bench: BenchState, x: number, y: number): void {
  const areaId = bench.areas.defAt(x, y);
  if (areaId) {
    ctx.fillStyle = AREA_DOT_COLORS[areaId] ?? "#ffffff";
    ctx.beginPath();
    ctx.arc(x * CELL_PX + 6, y * CELL_PX + 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const key = `${x},${y}`;
  const enemy = bench.enemies.get(key);
  const item = bench.items.get(key);
  if (enemy || item) {
    ctx.fillStyle = enemy ? "#ff5d5d" : "#ffd23d";
    ctx.fillRect(x * CELL_PX + CELL_PX - 8, y * CELL_PX + 2, 6, 6);
  }
}

function drawCell(ctx: CanvasRenderingContext2D, world: EditableWorld, x: number, y: number): void {
  const stack = world.stackAt(x, y);
  const cell = world.cellAt(x, y);
  const { fill, label } = cellStyle(stack, cell);
  ctx.fillStyle = fill;
  ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX - 1, CELL_PX - 1);
  // A floor cap atop a wall stack (walkable platform) gets a thin bright bottom
  // border — the "capped" tell the count badge alone can't show once it's gone.
  if (stack.cap !== null && stack.walls > 0) {
    ctx.fillStyle = "#ffd23d";
    ctx.fillRect(x * CELL_PX, y * CELL_PX + CELL_PX - 3, CELL_PX - 1, 2);
  }
  ctx.fillStyle = cell.height >= 3 ? "#14141c" : "#c8c8d6";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x * CELL_PX + CELL_PX / 2, y * CELL_PX + CELL_PX / 2);
}

/** AUTOTILE DEBUG toggle: every wall tile's cardinal mask, in hex, straight from the
 * store's live-resolved cache — lets the user verify the bitmask by hand, tile by tile. */
function drawAutotileDebugOverlay(ctx: CanvasRenderingContext2D, store: EditorStore, x: number, y: number): void {
  if (store.world.cellAt(x, y).tile !== TILE.Wall) return;
  const mask4 = store.autotileMasks.get(x, y)?.mask4;
  if (mask4 === undefined) return;
  ctx.fillStyle = "#ffd23d";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(maskHex(mask4), x * CELL_PX + CELL_PX / 2, y * CELL_PX + CELL_PX - 1);
}

export function drawGrid(canvas: HTMLCanvasElement, store: EditorStore): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  for (let y = 0; y < EDITOR_GRID_SIZE; y++) {
    for (let x = 0; x < EDITOR_GRID_SIZE; x++) {
      drawCell(ctx, store.world, x, y);
      drawBenchOverlay(ctx, store.bench, x, y);
      if (store.world.hasTorch(x, y)) drawTorchMarker(ctx, x, y);
      if (store.showAutotileDebug) drawAutotileDebugOverlay(ctx, store, x, y);
    }
  }
}
