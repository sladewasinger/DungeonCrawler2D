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
  const section = panel("World map & spawn");
  const map = mapCanvas();
  const workspace = document.createElement("div");
  workspace.dataset.adminMapWorkspace = "";
  const controls = mapControls();
  const catalog = createAdminSpawnCatalog();
  workspace.append(controls.root, map);
  section.append(workspace, catalog.root);
  return {
    root: section,
    map,
    catalog,
    mapLevel: controls.mapLevel,
    mapFloor: controls.mapFloor,
    spawnKind: controls.spawnKind,
    spawnDef: controls.spawnDef,
  };
}

function mapCanvas(): HTMLCanvasElement {
  const map = document.createElement("canvas");
  map.width = 800;
  map.height = 480;
  map.tabIndex = 0;
  map.dataset.adminMap = "";
  map.setAttribute("aria-label", "World map and spawn placement canvas");
  return map;
}

interface MapControls {
  readonly root: HTMLElement;
  readonly mapLevel: HTMLSelectElement;
  readonly mapFloor: HTMLInputElement;
  readonly spawnKind: HTMLSelectElement;
  readonly spawnDef: HTMLSelectElement;
}

function mapControls(): MapControls {
  const root = document.createElement("div");
  root.dataset.adminMapControls = "";
  const mapLevel = select("Map level", "adminMapLevel", ["dungeon", "sandbox"]);
  const mapFloor = mapFloorInput();
  const spawnKind = select("Spawn kind", "adminSpawnKind", ["enemy", "item", "weapon"]);
  const spawnDef = select("Definition", "adminSpawnDef", []);
  root.append(...mapControlContent({ mapLevel, mapFloor, spawnKind, spawnDef }));
  return { root, mapLevel, mapFloor, spawnKind, spawnDef };
}

function mapFloorInput(): HTMLInputElement {
  const floor = document.createElement("input");
  floor.type = "number";
  floor.min = "1";
  floor.max = "64";
  floor.value = "1";
  floor.title = "Map floor";
  floor.dataset.adminMapFloor = "";
  return floor;
}

function mapControlContent(controls: Omit<MapControls, "root">): readonly HTMLElement[] {
  const help = text("Select a card, then click a walkable cell to place it. Right-click an enemy or weapon marker to remove it. Hold Arrow keys or WASD to pan the map.");
  help.dataset.adminMapHelp = "";
  return [
    controlGroup("Map", controls.mapLevel, controls.mapFloor, actionButton("Load map", "inspect-map")),
    controlGroup("Camera", actionButton("Center selected", "map-center-selected"), actionButton("Free pan", "map-free-camera")),
    controlGroup("Spawn", controls.spawnKind, controls.spawnDef),
    help,
  ];
}

function controlGroup(label: string, ...controls: HTMLElement[]): HTMLElement {
  const group = document.createElement("section");
  group.dataset.adminMapControlGroup = "";
  const heading = document.createElement("h2");
  heading.textContent = label;
  group.setAttribute("aria-label", label);
  group.append(heading, ...controls);
  return group;
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
  section.append(title(label));
  return section;
}
