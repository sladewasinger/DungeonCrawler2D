import { LEVEL_IDS } from "@dc2d/engine";
import {
  actionButton,
  controlFieldset,
  text,
} from "./portal/adminPagePrimitives.js";
import { mapCanvasFieldset, mapLevelSelect, mapPanelSection } from "./adminMapPanelDom.js";
import {
  createAdminSpawnCatalog,
  type AdminSpawnCatalog,
} from "./catalog/adminSpawnCatalog.js";
import { createFreePanControl } from "./map/adminMapFreePan.js";

export interface AdminMapPanel {
  readonly root: HTMLElement;
  readonly map: HTMLCanvasElement;
  readonly mapLevel: HTMLSelectElement;
  readonly mapFloor: HTMLInputElement;
  readonly mapZoomStatus: HTMLElement;
  readonly catalog: AdminSpawnCatalog;
}

export function mapPanel(): AdminMapPanel {
  const section = mapPanelSection("Runtime entity spawner");
  const map = mapCanvas();
  const workspace = document.createElement("div");
  workspace.dataset.adminMapWorkspace = "";
  const controls = mapControls();
  const catalog = createAdminSpawnCatalog();
  workspace.append(controls.root, mapCanvasFieldset(map));
  workspace.append(catalog.root);
  section.append(workspace);
  return {
    root: section,
    map,
    catalog,
    mapLevel: controls.mapLevel,
    mapFloor: controls.mapFloor,
    mapZoomStatus: controls.mapZoomStatus,
  };
}

function mapCanvas(): HTMLCanvasElement {
  const map = document.createElement("canvas");
  map.width = 800;
  map.height = 480;
  map.tabIndex = 0;
  map.dataset.adminMap = "";
  map.setAttribute("aria-label", "Runtime entity spawner map");
  return map;
}

interface MapControls {
  readonly root: HTMLElement;
  readonly mapLevel: HTMLSelectElement;
  readonly mapFloor: HTMLInputElement;
  readonly mapZoomStatus: HTMLElement;
}

function mapControls(): MapControls {
  const root = document.createElement("div");
  root.dataset.adminMapControls = "";
  const mapLevel = mapLevelSelect("Map level", [...LEVEL_IDS]);
  const mapFloor = mapFloorInput();
  const mapZoomStatus = zoomStatus();
  root.append(...mapControlContent({ mapLevel, mapFloor, mapZoomStatus }));
  return { root, mapLevel, mapFloor, mapZoomStatus };
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
  const help = text("Click to place the selected runtime entity. Right-click an enemy or weapon marker to remove it. Middle-drag or use WASD/arrow keys to pan.");
  help.dataset.adminMapHelp = "";
  return [
    controlGroup("Map", controls.mapLevel, controls.mapFloor, actionButton("Load map", "inspect-map")),
    controlGroup(
      "Camera",
      actionButton("Center selected", "map-center-selected"),
      createFreePanControl(),
      mapZoomControls(controls.mapZoomStatus),
    ),
    help,
  ];
}

function mapZoomControls(status: HTMLElement): HTMLElement {
  const controls = document.createElement("div");
  controls.dataset.adminMapZoomControls = "";
  controls.append(
    zoomButton("−", "map-zoom-out", "Zoom world editor out"),
    actionButton("100%", "map-zoom-reset"),
    zoomButton("+", "map-zoom-in", "Zoom world editor in"),
    status,
  );
  return controls;
}

function zoomStatus(): HTMLElement {
  const status = text("Zoom: 100%");
  status.dataset.adminMapZoomStatus = "";
  status.setAttribute("aria-live", "polite");
  return status;
}

function zoomButton(label: string, action: string, accessibleLabel: string): HTMLButtonElement {
  const control = actionButton(label, action);
  control.title = accessibleLabel;
  control.setAttribute("aria-label", accessibleLabel);
  return control;
}

function controlGroup(label: string, ...controls: HTMLElement[]): HTMLElement {
  const group = controlFieldset(label);
  group.dataset.adminMapControlGroup = "";
  group.append(...controls);
  return group;
}
