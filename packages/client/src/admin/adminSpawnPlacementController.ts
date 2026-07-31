import type { Connection } from "../net/connection/connection.js";
import type { AdminSpectatorSurface, AdminSpawnSelection } from "./adminSpectatorSurface.js";
import type { AdminPageView } from "./adminPageView.js";
import {
  adminOption,
  adminSpawnKind,
  boundedAdminFloor,
  paletteDefinitions,
} from "./adminPageSupport.js";

export interface AdminSpawnPlacementControllerOptions {
  readonly connection: Connection;
  readonly view: AdminPageView;
  readonly surface: AdminSpectatorSurface;
}

export class AdminSpawnPlacementController {
  private readonly connection: Connection;
  private readonly view: AdminPageView;
  private readonly surface: AdminSpectatorSurface;

  constructor(options: AdminSpawnPlacementControllerOptions) {
    this.connection = options.connection;
    this.view = options.view;
    this.surface = options.surface;
    this.wireControls();
    this.render();
  }

  render(): void {
    const kind = adminSpawnKind(this.view.spawnKind.value);
    const definitionIds = paletteDefinitions(this.connection.adminPalette, kind);
    const selected = this.view.spawnDef.value;
    this.view.spawnDef.replaceChildren(...definitionIds.map((value) => adminOption(value)));
    if (definitionIds.includes(selected)) this.view.spawnDef.value = selected;
    this.updateSelection();
  }

  requestMap(x: number, y: number): void {
    if (!this.connection.adminAuthenticated) return;
    const map = this.connection.adminMap;
    const level = this.view.mapLevel.value === "sandbox" ? "sandbox" : "dungeon";
    const floor = boundedAdminFloor(this.view.mapFloor.value, map?.floor ?? 1);
    this.connection.sendAdminCommand({ op: "map", level, floor, x, y, radius: map?.radius ?? 10 });
  }

  spawn(x: number, y: number, selection: AdminSpawnSelection): void {
    const map = this.connection.adminMap;
    if (!this.connection.adminAuthenticated || !map) return;
    this.connection.sendAdminCommand({
      op: "spawn",
      kind: selection.kind,
      defId: selection.defId,
      level: map.level,
      floor: map.floor,
      x,
      y,
    });
  }

  despawn(entityId: string): void {
    const map = this.connection.adminMap;
    if (!this.connection.adminAuthenticated || !map) return;
    this.connection.sendAdminCommand({ op: "despawn", level: map.level, floor: map.floor, entityId });
  }

  inspectCurrentMap(): void {
    const center = this.connection.adminMap?.center ?? { x: 0, y: 0 };
    this.requestMap(center.x, center.y);
  }

  private wireControls(): void {
    this.view.spawnKind.addEventListener("change", () => this.render());
    this.view.spawnDef.addEventListener("change", () => this.updateSelection());
    this.view.mapLevel.addEventListener("change", () => this.inspectCurrentMap());
    this.view.mapFloor.addEventListener("change", () => this.inspectCurrentMap());
  }

  private updateSelection(): void {
    const kind = adminSpawnKind(this.view.spawnKind.value);
    this.surface.setSelection({ kind, defId: this.view.spawnDef.value });
    this.renderCatalog(kind);
  }

  private renderCatalog(kind: AdminSpawnSelection["kind"]): void {
    this.view.catalog.render({
      kind,
      selectedId: this.view.spawnDef.value,
      disabled: !this.connection.adminAuthenticated,
      onSelect: (definitionId) => this.selectCatalogDefinition(definitionId),
    });
  }

  private selectCatalogDefinition(definitionId: string): void {
    this.view.spawnDef.value = definitionId;
    this.render();
  }
}
