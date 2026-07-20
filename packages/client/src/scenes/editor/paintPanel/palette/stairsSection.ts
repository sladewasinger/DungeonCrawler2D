// STAIRS: a direction-rotatable brush with the real sprite. The catalog only has
// climb-north art (medieval-sewer, dragon-cave — docs/ASSUMPTIONS.md row #202), so
// east/south/west rotate that same sprite via CSS transform rather than inventing art
// that doesn't exist; @dc2d/engine's compile step interpolates the run's actual height
// regardless of which way the icon is drawn.
import { tileCatalog, type StairRef } from "@dc2d/content";
import type { StackDir } from "@dc2d/engine";
import type { EditorStore } from "../../editorStore.js";
import { sectionLabel } from "../domHelpers.js";
import { spriteSwatch } from "./spriteSwatch.js";

const DIRECTION_LABEL: Readonly<Record<StackDir, string>> = { 0: "N", 1: "E", 2: "S", 3: "W" };
/** Degrees to rotate the north-climbing sprite so it reads as climbing this direction. */
const DIRECTION_ROTATION: Readonly<Record<StackDir, number>> = { 0: 0, 1: 90, 2: 180, 3: 270 };

function representativeStairRef(): { packId: string; ref: StairRef } | null {
  for (const [packId, pack] of Object.entries(tileCatalog.packs)) {
    const ref = pack.stairs.find((s) => s.functional && s.climbDirection === "north");
    if (ref) return { packId, ref };
  }
  return null;
}

export function buildStairsSection(store: EditorStore): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin:8px 0";
  wrap.append(sectionLabel("STAIRS"));
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;align-items:center;gap:6px";
  const rep = representativeStairRef();
  const directions: StackDir[] = [0, 1, 2, 3];
  for (const dir of directions) {
    const b = document.createElement("button");
    b.title = `climbs ${DIRECTION_LABEL[dir]}`;
    b.style.cssText = "background:#1a1a24;border:1px solid #494956;border-radius:4px;padding:3px;cursor:pointer";
    if (rep) {
      // A fresh swatch per direction (not a clone — canvas pixel content isn't
      // cloneNode-able), rotated via CSS to fake the missing off-north art.
      const sprite = spriteSwatch(rep.packId, rep.ref, 28);
      sprite.style.transform = `rotate(${DIRECTION_ROTATION[dir]}deg)`;
      b.append(sprite);
    } else {
      b.textContent = DIRECTION_LABEL[dir];
    }
    b.addEventListener("click", () => {
      store.brush = { kind: "stairs", direction: dir };
      for (const el of bar.querySelectorAll("button")) (el as HTMLButtonElement).style.outline = "";
      b.style.outline = "2px solid #ffd23d";
    });
    bar.append(b);
  }
  wrap.append(bar);
  return wrap;
}
