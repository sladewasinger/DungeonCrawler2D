// Collision toggle + reset + import/export — unchanged plumbing from the pre-reskin
// paint panel, just relocated under palette/ alongside the new brush sections.
import type { EditorStore } from "../../editorStore.js";
import { EDITOR_PROBLEM_MAPS } from "../../problemMaps.js";
import { button } from "../domHelpers.js";

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

export function buildFileSection(store: EditorStore, refresh: () => void): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;margin:8px 0";
  bar.append(button("collision", () => store.toggleCollision()));
  bar.append(button("autotile debug", () => (store.toggleAutotileDebug(), refresh())));
  bar.append(button("new blank map", () => (store.reset(), refresh())));
  for (const map of EDITOR_PROBLEM_MAPS) {
    const load = button(map.label, () => {
      store.importJson(map.exportJson());
      refresh();
    });
    load.title = map.description;
    bar.append(load);
  }
  bar.append(...buildFileButtons(store, refresh));
  return bar;
}
