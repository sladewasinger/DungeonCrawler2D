// WALL: one brush, per Austin's decree ("no more z buttons... I can put as many walls
// as needed, then a floor on top"). Which pack's wall art actually renders is a
// deterministic per-position mix (the renderer lane's packArt.ts), not a per-tile
// choice — this brush only ever stacks; it never picks a variant.
import { tileCatalog, type TileRef } from "@dc2d/content";
import type { EditorStore } from "../../editorStore.js";
import { button, sectionLabel } from "../domHelpers.js";
import { spriteSwatch } from "./spriteSwatch.js";

/** First pack with any wallFace art — a representative icon only, not an authored choice. */
function representativeWallRef(): { packId: string; ref: TileRef } | null {
  for (const [packId, pack] of Object.entries(tileCatalog.packs)) {
    if (pack.wallFace.length > 0) return { packId, ref: pack.wallFace[0]! }; // length checked above
  }
  return null;
}

export function buildWallSection(store: EditorStore): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0";
  wrap.append(sectionLabel("WALL"));
  const rep = representativeWallRef();
  const b = button("wall (stacks +1)", () => (store.brush = { kind: "wall" }));
  b.style.display = "flex";
  b.style.alignItems = "center";
  b.style.gap = "6px";
  if (rep) b.prepend(spriteSwatch(rep.packId, rep.ref, 22));
  wrap.append(b);
  return wrap;
}
