import { tileCatalog, type StairRef } from "@dc2d/content";
import type { EditorStore } from "../../editorStore.js";
import { sectionLabel } from "../domHelpers.js";
import { spriteSwatch } from "./spriteSwatch.js";

function representativeStairRef(): { packId: string; ref: StairRef } | null {
  for (const [packId, pack] of Object.entries(tileCatalog.packs)) {
    const ref = pack.stairs.find((stair) =>
      stair.functional && stair.climbDirection === "north");
    if (ref) return { packId, ref };
  }
  return null;
}

export function buildStairsSection(
  store: EditorStore,
  refresh: () => void,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0";
  wrap.append(sectionLabel("STAIRS"));
  const select = document.createElement("button");
  select.title = "Place stairs with two adjacent tile clicks.";
  select.style.cssText =
    "display:flex;align-items:center;gap:6px;background:#1a1a24;color:#d9d9e4;" +
    "border:1px solid #494956;border-radius:4px;padding:3px 8px;cursor:pointer;" +
    "font:12px monospace";
  const representative = representativeStairRef();
  if (representative) {
    select.append(spriteSwatch(representative.packId, representative.ref, 28));
  }
  select.append("stairs (2 clicks)");
  const status = document.createElement("div");
  status.style.cssText =
    "font:11px/15px monospace;color:#ffd23d;margin-top:4px;min-height:30px";
  const sync = (): void => {
    const pending = store.pendingStairOrigin;
    select.style.outline = store.brush.kind === "stairs" ? "2px solid #ffd23d" : "";
    status.textContent = pending
      ? `Start: (${pending.x}, ${pending.y}). Click an adjacent destination; a lower tile descends. Right-click cancels.`
      : "Click the stair tile, then an adjacent destination. The tool authors a one-level transition.";
    refresh();
  };
  select.addEventListener("click", () => {
    store.brush = { kind: "stairs" };
  });
  store.onChange(sync);
  wrap.append(select, status);
  sync();
  return wrap;
}
