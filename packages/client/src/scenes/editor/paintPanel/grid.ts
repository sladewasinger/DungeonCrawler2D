// The left panel's 20x20 canvas: terrain cell fills/labels, plus small bench overlay
// glyphs (Epic 7.11) so painted areas/enemies/items are visible without switching to
// the right (real-renderer) panel.
import { TILE } from "@dc2d/engine";
import type { BenchState } from "../bench/index.js";
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";
import type { EditorStore } from "../editorStore.js";

export const CELL_PX = 26;

const CELL_COLORS: Record<string, string> = { rock: "#6b6b7e", door: "#3dd6c3" };
const AREA_DOT_COLORS: Record<string, string> = {
  "area-fire": "#ff9e3d",
  "area-poison": "#7bd44a",
  "area-oil": "#8a6d3b",
  "area-wet": "#3d9fff",
  "area-steam": "#d8dde6",
};

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

export function drawGrid(canvas: HTMLCanvasElement, store: EditorStore): void {
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
      drawBenchOverlay(ctx, store.bench, x, y);
    }
  }
}
