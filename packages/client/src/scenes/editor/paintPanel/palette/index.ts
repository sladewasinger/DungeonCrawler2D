// The terrain palette facade: finite floor height, void, stairs, doors/torches, and
// file controls. Consumers (paintPanel/index.ts) import only this file.
import type { EditorStore } from "../../editorStore.js";
import { buildDoorTorchSection } from "./doorTorchSection.js";
import { buildFileSection } from "./fileSection.js";
import { buildTerrainSection } from "./terrainSection.js";

export function buildTerrainPalette(store: EditorStore, refresh: () => void): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.append(
    buildTerrainSection(store, refresh),
    buildDoorTorchSection(store),
    buildFileSection(store, refresh),
  );
  return wrap;
}
