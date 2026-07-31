import { actionButton, text, title } from "./adminPagePrimitives.js";
import {
  createAdminSpawnCatalog,
  type AdminSpawnCatalog,
} from "./catalog/adminSpawnCatalog.js";

type AdminSelectDataKey = "adminMapLevel" | "adminSpawnKind" | "adminSpawnDef";

export interface AdminMapPanel {
  readonly root: HTMLElement;
  readonly map: HTMLCanvasElement;
  readonly mapLevel: HTMLSelectElement;
  readonly mapFloor: HTMLInputElement;
  readonly spawnKind: HTMLSelectElement;
  readonly spawnDef: HTMLSelectElement;
  readonly catalog: AdminSpawnCatalog;
}

export function mapPanel(): AdminMapPanel {
  const section = panel("Spawn / map contract");
  const map = document.createElement("canvas");
  map.width = 800;
  map.height = 480;
  map.tabIndex = 0;
  map.style.cssText = "width:100%;max-width:800px;min-height:320px;border:1px solid #394152;image-rendering:pixelated;outline:none";
  map.dataset.adminMap = "";
  const tools = document.createElement("div");
  tools.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%";
  const mapLevel = select("Map level", "adminMapLevel", ["dungeon", "sandbox"]);
  const mapFloor = document.createElement("input");
  mapFloor.type = "number";
  mapFloor.min = "1";
  mapFloor.max = "64";
  mapFloor.value = "1";
  mapFloor.title = "Map floor";
  mapFloor.dataset.adminMapFloor = "";
  const spawnKind = select("Spawn kind", "adminSpawnKind", ["enemy", "item", "weapon"]);
  const spawnDef = select("Definition", "adminSpawnDef", []);
  const catalog = createAdminSpawnCatalog();
  tools.append(
    mapLevel,
    mapFloor,
    actionButton("Inspect", "inspect-map"),
    spawnKind,
    spawnDef,
    text("Select a card, then click a walkable cell to place it. Right-click an enemy or weapon marker to remove it. Arrow/WASD moves the map."),
  );
  section.append(map, tools, catalog.root);
  return { root: section, map, mapLevel, mapFloor, spawnKind, spawnDef, catalog };
}

function select(label: string, key: AdminSelectDataKey, values: readonly string[]): HTMLSelectElement {
  const selectElement = document.createElement("select");
  selectElement.title = label;
  selectElement.dataset[key] = "";
  for (const value of values) selectElement.append(option(value));
  return selectElement;
}

function option(value: string): HTMLOptionElement {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = value;
  return element;
}

function panel(label: string): HTMLElement {
  const section = document.createElement("section");
  section.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:14px;background:#1b1f2a;border:1px solid #394152;border-radius:6px";
  section.append(title(label));
  return section;
}
