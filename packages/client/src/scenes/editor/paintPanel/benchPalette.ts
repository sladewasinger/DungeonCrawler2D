// EFFECTS + SPAWN palette (Epic 7.11): area/enemy/item brushes that paint into the
// bench (bench/index.ts) instead of the terrain, plus the SIMULATE toggle and the
// bench's own RESET — independent of the terrain canvas's own reset button.
import { AREA_BRUSHES, ENEMY_BRUSH_IDS, GROUND_ITEM_BRUSH_ID, enemyDef } from "../bench/index.js";
import type { EditorStore } from "../editorStore.js";
import { button, selectButton } from "./domHelpers.js";

function sectionLabel(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = "font:11px monospace;color:#8f8fa3;margin-top:6px";
  return el;
}

function buildEffectsBar(store: EditorStore): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";
  for (const areaBrush of AREA_BRUSHES) {
    const b = button(areaBrush.label, () => {
      store.brush = { kind: "area", areaId: areaBrush.areaId };
      selectButton(bar, b);
    });
    bar.append(b);
  }
  return bar;
}

function buildSpawnBar(store: EditorStore): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";
  for (const defId of ENEMY_BRUSH_IDS) {
    const b = button(enemyDef(defId)?.name ?? defId, () => {
      store.brush = { kind: "spawn-enemy", defId };
      selectButton(bar, b);
    });
    bar.append(b);
  }
  const item = button("ground item", () => {
    store.brush = { kind: "spawn-item", defId: GROUND_ITEM_BRUSH_ID };
    selectButton(bar, item);
  });
  bar.append(item);
  return bar;
}

/** SIMULATE + RESET BENCH row: SIMULATE just flips a running flag (pause-in-place),
 * RESET clears the bench back to blank. */
function buildBenchControls(store: EditorStore, refresh: () => void): HTMLDivElement {
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;gap:4px;margin-top:8px";
  const simulateBtn = button("SIMULATE ▶", () => {
    store.toggleSimulate();
    const running = store.bench.running;
    simulateBtn.style.background = running ? "#2e7d32" : "#1a1a24";
    simulateBtn.textContent = running ? "SIMULATE ⏸" : "SIMULATE ▶";
  });
  controls.append(simulateBtn, button("RESET BENCH", () => (store.resetBench(), refresh())));
  return controls;
}

export function buildBenchPalette(store: EditorStore, refresh: () => void): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0";
  wrap.append(
    sectionLabel("EFFECTS"),
    buildEffectsBar(store),
    sectionLabel("SPAWN"),
    buildSpawnBar(store),
    buildBenchControls(store, refresh),
  );
  return wrap;
}
