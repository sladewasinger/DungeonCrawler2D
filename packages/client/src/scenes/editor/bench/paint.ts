// Bench painting (Epic 7.11): area/enemy/item brushes mutate the live bench state
// directly — see state.ts's doc comment for why that gives SIMULATE its pause-in-place
// semantics for free. RESET is the one operation that tears anything down, clearing the
// bench back to blank independent of the terrain canvas's own reset.
import { AREA_BRUSHES } from "./content.js";
import { createDummy } from "./dummy.js";
import { spawnBenchEnemy } from "./enemySim.js";
import { freshAreas, type BenchState } from "./state.js";
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";

export type BenchLayer = "area" | "enemy" | "item";

const cellKey = (x: number, y: number): string => `${x},${y}`;

export function paintArea(state: BenchState, x: number, y: number, areaId: string): void {
  if (!AREA_BRUSHES.some((b) => b.areaId === areaId)) return;
  state.areas.place(areaId, x, y, 0);
}

export function paintEnemy(state: BenchState, x: number, y: number, defId: string): void {
  spawnBenchEnemy(state, defId, x, y, cellKey(x, y));
}

export function paintItem(state: BenchState, x: number, y: number, defId: string): void {
  state.items.set(cellKey(x, y), { id: cellKey(x, y), defId, x: x + 0.5, y: y + 0.5 });
}

/** Right-click erase for whichever bench layer the active brush belongs to. */
export function eraseBenchCell(state: BenchState, x: number, y: number, layer: BenchLayer): void {
  if (layer === "area") state.areas.remove(x, y);
  else if (layer === "enemy") state.enemies.delete(cellKey(x, y));
  else state.items.delete(cellKey(x, y));
}

/** Clears every painted area/enemy/item, stops SIMULATE, and resets the dummy — a blank
 * effects canvas, independent of the terrain grid underneath it (Assumption #26). */
export function resetBench(state: BenchState): void {
  state.areas = freshAreas(state.world, state.content);
  state.enemies.clear();
  state.items.clear();
  const center = Math.floor(EDITOR_GRID_SIZE / 2);
  state.dummy = createDummy(center, center);
  state.running = false;
  state.tickAccumMs = 0;
  state.tickCount = 0;
}
