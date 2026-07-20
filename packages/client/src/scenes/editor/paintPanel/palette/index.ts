// The terrain palette facade: FLOOR/WALL/STAIRS/DOOR-TORCH brush sections plus file
// controls — Austin's decreed vocabulary ("no more z buttons, just floor varieties,
// walls, stairs"). Consumers (paintPanel/index.ts) import only this file.
import type { EditorStore } from "../../editorStore.js";
import { buildDoorTorchSection } from "./doorTorchSection.js";
import { buildFileSection } from "./fileSection.js";
import { buildFloorSection } from "./floorSection.js";
import { buildStairsSection } from "./stairsSection.js";
import { buildWallSection } from "./wallSection.js";

export function buildTerrainPalette(store: EditorStore, refresh: () => void): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.append(
    buildFloorSection(store),
    buildWallSection(store),
    buildStairsSection(store),
    buildDoorTorchSection(store),
    buildFileSection(store, refresh),
  );
  return wrap;
}
