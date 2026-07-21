import { DEFAULT_FLOOR_CAP } from "@dc2d/engine";
import type { EditorStore } from "../../editorStore.js";
import { button, sectionLabel, selectButton } from "../domHelpers.js";

export function buildTerrainSection(store: EditorStore): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0;max-width:500px";
  wrap.append(sectionLabel("TERRAIN"));

  const help = document.createElement("div");
  help.textContent = "Height: left-click raises floor +1; right-click lowers it -1. Void: left-click paints solid void; right-click restores the floor at its current height.";
  help.style.cssText = "font:11px monospace;color:#6d6d80;margin:4px 0";

  const tools = document.createElement("div");
  tools.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";
  const height = button("height", () => {
    store.brush = { kind: "floor", capId: DEFAULT_FLOOR_CAP };
    selectButton(tools, height);
  });
  const voidBrush = button("void", () => {
    store.brush = { kind: "void" };
    selectButton(tools, voidBrush);
  });
  height.title = "Raise or lower an explicit floor height.";
  voidBrush.title = "Paint a non-walkable void tile without changing its height.";
  tools.append(height, voidBrush);
  selectButton(tools, store.brush.kind === "void" ? voidBrush : height);
  wrap.append(help, tools);
  return wrap;
}
