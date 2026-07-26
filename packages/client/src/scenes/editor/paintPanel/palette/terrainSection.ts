import { DEFAULT_FLOOR_CAP } from "@dc2d/engine";
import type { EditorStore } from "../../editorStore.js";
import { button, sectionLabel } from "../domHelpers.js";

export function buildTerrainSection(store: EditorStore, refresh: () => void): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0;max-width:500px";
  wrap.append(sectionLabel("TERRAIN"));

  const help = document.createElement("div");
  help.textContent = "Height: left-click raises floor +1; right-click lowers it -1. Void: left-click paints void; right-click restores it. Stairs: click the tread, then an adjacent destination. Reset to 0: restores a flat floor and removes stairs/void.";
  help.style.cssText = "font:11px monospace;color:#6d6d80;margin:4px 0";

  const tools = document.createElement("div");
  tools.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";
  const height = button("height", () => {
    store.brush = { kind: "floor", capId: DEFAULT_FLOOR_CAP };
  });
  const voidBrush = button("void", () => {
    store.brush = { kind: "void" };
  });
  const stairs = button("stairs", () => {
    store.brush = { kind: "stairs" };
  });
  const resetToZero = button("reset to 0", () => {
    store.brush = { kind: "reset-to-zero" };
  });
  height.title = "Raise or lower an explicit floor height.";
  voidBrush.title = "Paint a non-walkable void tile without changing its height.";
  stairs.title = "Place a one-level stair transition with two adjacent clicks.";
  resetToZero.title = "Restore a flat z=0 floor, removing any stair or void.";
  tools.append(height, voidBrush, stairs, resetToZero);
  const sync = (): void => {
    const active = store.brush.kind;
    height.style.outline = active === "floor" ? "2px solid #ffd23d" : "";
    voidBrush.style.outline = active === "void" ? "2px solid #ffd23d" : "";
    stairs.style.outline = active === "stairs" ? "2px solid #ffd23d" : "";
    resetToZero.style.outline = active === "reset-to-zero" ? "2px solid #ffd23d" : "";
    refresh();
  };
  store.onChange(sync);
  sync();
  wrap.append(help, tools);
  return wrap;
}
