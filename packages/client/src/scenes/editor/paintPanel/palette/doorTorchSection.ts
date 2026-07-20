// DOOR + TORCH: door punches into an existing uncapped wall stack (EditableWorld
// enforces the guard); torch is the editor-only light source, stampable anywhere.
// Real sprite icons where the catalog has one — door does, torches vary by pack.
import { tileCatalog, type TileRef } from "@dc2d/content";
import type { EditorStore } from "../../editorStore.js";
import { button, sectionLabel } from "../domHelpers.js";
import { spriteSwatch } from "./spriteSwatch.js";

function firstRefWithArt(category: "doors" | "torches"): { packId: string; ref: TileRef } | null {
  for (const [packId, pack] of Object.entries(tileCatalog.packs)) {
    const ref = pack[category][0];
    if (ref) return { packId, ref };
  }
  return null;
}

function iconButton(label: string, category: "doors" | "torches", onClick: () => void): HTMLButtonElement {
  const b = button(label, onClick);
  b.style.display = "flex";
  b.style.alignItems = "center";
  b.style.gap = "6px";
  const rep = firstRefWithArt(category);
  if (rep) b.prepend(spriteSwatch(rep.packId, rep.ref, 22));
  return b;
}

export function buildDoorTorchSection(store: EditorStore): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0";
  wrap.append(sectionLabel("DOOR / TORCH"));
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";
  bar.append(
    iconButton("door", "doors", () => (store.brush = { kind: "door" })),
    iconButton("torch", "torches", () => (store.brush = { kind: "torch" })),
    button("erase", () => (store.brush = { kind: "erase" })),
  );
  wrap.append(bar);
  return wrap;
}
