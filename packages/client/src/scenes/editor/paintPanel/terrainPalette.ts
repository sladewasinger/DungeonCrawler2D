// Terrain brush palette: height/rock/door stamps, collision toggle, terrain
// import/export/reset — unchanged from the pre-Epic-7.11 paint panel, just split out
// of the folder that now also holds the bench (EFFECTS/SPAWN) palette.
import type { EditorStore } from "../editorStore.js";
import { button, selectButton } from "./domHelpers.js";

const HEIGHT_BRUSHES = [-1, 0, 1, 2, 3, 4, 6, 8] as const;

function buildHeightButtons(store: EditorStore, bar: HTMLElement): void {
  for (const h of HEIGHT_BRUSHES) {
    const b = button(`z${h}`, () => {
      store.brush = { kind: "height", value: h };
      selectButton(bar, b);
    });
    if (h === 1) b.style.outline = "2px solid #ffd23d";
    bar.append(b);
  }
  const rock = button("rock", () => {
    store.brush = { kind: "rock" };
    selectButton(bar, rock);
  });
  const door = button("door", () => {
    store.brush = { kind: "door" };
    selectButton(bar, door);
  });
  bar.append(rock, door);
}

function buildFileButtons(store: EditorStore, refresh: () => void): HTMLButtonElement[] {
  const importBtn = button("import", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (file) store.importJson(await file.text());
      refresh();
    });
    input.click();
  });
  const exportBtn = button("export", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([store.exportJson()], { type: "application/json" }));
    a.download = "dc2d-editor-map.json";
    a.click();
  });
  return [importBtn, exportBtn];
}

export function buildTerrainPalette(store: EditorStore, refresh: () => void): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin:8px 0";
  buildHeightButtons(store, bar);
  bar.append(button("collision", () => store.toggleCollision()));
  bar.append(button("reset", () => (store.reset(), refresh())));
  bar.append(...buildFileButtons(store, refresh));
  return bar;
}
