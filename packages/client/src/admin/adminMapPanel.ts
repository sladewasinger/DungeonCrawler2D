import {
  actionButton,
  controlFieldset,
  text,
  title,
} from "./adminPagePrimitives.js";
import {
  createAdminSpawnCatalog,
  type AdminSpawnCatalog,
} from "./catalog/adminSpawnCatalog.js";

export interface AdminMapPanel {
  readonly root: HTMLElement;
  readonly map: HTMLCanvasElement;
  readonly mapLevel: HTMLSelectElement;
  readonly mapFloor: HTMLInputElement;
  readonly catalog: AdminSpawnCatalog;
}

export function mapPanel(): AdminMapPanel {
  const section = panel("World editor");
  const map = mapCanvas();
  const workspace = document.createElement("div");
  workspace.dataset.adminMapWorkspace = "";
  const controls = mapControls();
  const catalog = createAdminSpawnCatalog();
  workspace.append(controls.root, mapFieldset(map));
  section.append(workspace, catalog.root);
  return {
    root: section,
    map,
    catalog,
    mapLevel: controls.mapLevel,
    mapFloor: controls.mapFloor,
  };
}

function mapCanvas(): HTMLCanvasElement {
  const map = document.createElement("canvas");
  map.width = 800;
  map.height = 480;
  map.tabIndex = 0;
  map.dataset.adminMap = "";
  map.setAttribute("aria-label", "World editor map and placement canvas");
  return map;
}

function mapFieldset(map: HTMLCanvasElement): HTMLFieldSetElement {
  const fieldset = controlFieldset("Map");
  fieldset.dataset.adminMapCanvasSection = "";
  fieldset.append(map);
  return fieldset;
}

interface MapControls {
  readonly root: HTMLElement;
  readonly mapLevel: HTMLSelectElement;
  readonly mapFloor: HTMLInputElement;
}

function mapControls(): MapControls {
  const root = document.createElement("div");
  root.dataset.adminMapControls = "";
  const mapLevel = select("Map level", ["dungeon", "sandbox"]);
  const mapFloor = mapFloorInput();
  root.append(...mapControlContent({ mapLevel, mapFloor }));
  return { root, mapLevel, mapFloor };
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
  const help = text("Click once to focus the map, then choose a tab and card to place it on a walkable cell. Right-click an enemy or weapon marker to remove it. Hold Arrow keys or WASD to pan.");
  help.dataset.adminMapHelp = "";
  return [
    controlGroup("Map", controls.mapLevel, controls.mapFloor, actionButton("Load map", "inspect-map")),
    controlGroup("Camera", actionButton("Center selected", "map-center-selected"), actionButton("Free pan", "map-free-camera")),
    help,
  ];
}

function controlGroup(label: string, ...controls: HTMLElement[]): HTMLElement {
  const group = controlFieldset(label);
  group.dataset.adminMapControlGroup = "";
  group.append(...controls);
  return group;
}

function select(label: string, values: readonly string[]): HTMLSelectElement {
  const selectElement = document.createElement("select");
  selectElement.title = label;
  selectElement.dataset.adminMapLevel = "";
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
