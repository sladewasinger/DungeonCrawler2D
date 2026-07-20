// FLOOR: real-sprite variant swatches grouped by pack. Clicking one sets the floor
// brush's `capId` — @dc2d/engine's StackTile.cap is an opaque floor-variant id string
// (its doc comment: "a real cap value is a floor-variant id the art/editor lane
// picks"); this lane's convention is `"<packId>:<floorVariants index>"`.
import { tileCatalog } from "@dc2d/content";
import type { EditorStore } from "../../editorStore.js";
import { sectionLabel } from "../domHelpers.js";
import { spriteSwatch } from "./spriteSwatch.js";

/** `"<packId>:<index>"` — the floor-cap id this lane's swatches author. */
export function floorCapId(packId: string, index: number): string {
  return `${packId}:${index}`;
}

function swatchButton(store: EditorStore, packId: string, index: number, bar: HTMLElement): HTMLButtonElement {
  // packId/index always come from iterating tileCatalog.packs itself (buildPackRow),
  // so both lookups are guaranteed present.
  const ref = tileCatalog.packs[packId]!.floorVariants[index]!;
  const b = document.createElement("button");
  b.title = ref.label;
  b.style.cssText = "background:#1a1a24;border:1px solid #494956;border-radius:4px;padding:2px;cursor:pointer";
  b.append(spriteSwatch(packId, ref));
  b.addEventListener("click", () => {
    store.brush = { kind: "floor", capId: floorCapId(packId, index) };
    for (const el of bar.querySelectorAll("button")) (el as HTMLButtonElement).style.outline = "";
    b.style.outline = "2px solid #ffd23d";
  });
  return b;
}

function buildPackRow(store: EditorStore, packId: string, bar: HTMLElement): HTMLDivElement {
  // packId is always one of Object.keys(tileCatalog.packs) (buildFloorSection's loop).
  const pack = tileCatalog.packs[packId]!;
  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:2px 0";
  const label = document.createElement("span");
  label.textContent = pack.displayName;
  label.style.cssText = "font:10px monospace;color:#6d6d80;flex:0 0 108px";
  row.append(label);
  for (let i = 0; i < pack.floorVariants.length; i++) row.append(swatchButton(store, packId, i, bar));
  return row;
}

export function buildFloorSection(store: EditorStore): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0";
  const bar = document.createElement("div");
  wrap.append(sectionLabel("FLOOR"));
  for (const packId of Object.keys(tileCatalog.packs)) bar.append(buildPackRow(store, packId, bar));
  wrap.append(bar);
  return wrap;
}
