import type { AdminMap, AdminPlayer } from "@dc2d/engine";
import type { Connection } from "../net/connection/connection.js";
import type { AdminSpectatorSurface, AdminSpawnSelection } from "./adminSpectatorSurface.js";
import type { AdminPageView } from "./adminPageView.js";
import {
  emptyAdminSpawnSelections,
  selectionForAdminSpawnKind,
  validAdminSpawnSelection,
  withAdminSpawnDefinition,
  type AdminSpawnSelections,
} from "./catalog/adminSpawnSelection.js";
import { petOwnerForAdminMap } from "./catalog/adminPetPlacement.js";
import { AdminMapCameraController } from "./map/camera/adminMapCameraController.js";
import { paletteDefinitions } from "./adminPageSupport.js";

export interface AdminSpawnPlacementControllerOptions {
  readonly connection: Connection;
  readonly view: AdminPageView;
  readonly surface: AdminSpectatorSurface;
  readonly selectedPlayer: () => AdminPlayer | null;
}

export class AdminSpawnPlacementController {
  private readonly connection: Connection;
  private readonly view: AdminPageView;
  private readonly surface: AdminSpectatorSurface;
  private readonly selectedPlayer: () => AdminPlayer | null;
  private readonly mapCamera: AdminMapCameraController;
  private selections: AdminSpawnSelections = emptyAdminSpawnSelections();
  private selection: AdminSpawnSelection = { kind: "enemy", defId: "" };

  constructor(options: AdminSpawnPlacementControllerOptions) {
    this.connection = options.connection;
    this.view = options.view;
    this.surface = options.surface;
    this.selectedPlayer = options.selectedPlayer;
    this.mapCamera = new AdminMapCameraController(options);
    this.wireControls();
    this.render();
  }

  render(): void {
    this.selection = validAdminSpawnSelection(this.connection.adminPalette, this.selection);
    this.selections = withAdminSpawnDefinition(this.selections, this.selection);
    this.surface.setSelection({
      ...this.selection,
      placementAllowed: this.canPlaceSelectedDefinition(),
    });
    this.renderCatalog();
  }

  requestMap(x: number, y: number): void {
    this.mapCamera.panTo({ x, y });
  }

  inspectDefaultMap(): void {
    this.mapCamera.inspectDefaultMap();
  }

  followPlayer(player: AdminPlayer | null): void {
    this.mapCamera.followPlayer(player);
  }

  freeCamera(): void {
    this.mapCamera.freeCamera();
  }

  refreshFollow(): void {
    this.mapCamera.refreshFollow();
  }

  dispose(): void {
    this.mapCamera.dispose();
  }

  spawn(x: number, y: number, selection: AdminSpawnSelection): void {
    const map = this.connection.adminMap;
    if (!this.connection.adminAuthenticated || !map || !selection.defId) return;
    if (selection.kind === "pet") return this.spawnPet({ map, x, y, selection });
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

  private spawnPet(input: PetSpawnInput): void {
    const ownerPlayerId = this.petOwnerId(input.map);
    if (!ownerPlayerId) return;
    this.connection.sendAdminCommand({
      op: "spawn",
      kind: "pet",
      defId: input.selection.defId,
      level: input.map.level,
      floor: input.map.floor,
      x: input.x,
      y: input.y,
      ownerPlayerId,
    });
  }

  despawn(entityId: string): void {
    const map = this.connection.adminMap;
    if (!this.connection.adminAuthenticated || !map) return;
    this.connection.sendAdminCommand({ op: "despawn", level: map.level, floor: map.floor, entityId });
  }

  inspectCurrentMap(): void {
    this.mapCamera.inspectCurrentMap();
  }

  private wireControls(): void {
    this.view.mapLevel.addEventListener("change", () => this.inspectCurrentMap());
    this.view.mapFloor.addEventListener("change", () => this.inspectCurrentMap());
  }

  private renderCatalog(): void {
    const availableIds = paletteDefinitions(this.connection.adminPalette, this.selection.kind);
    const petPlacementDisabled = this.selection.kind === "pet" && !this.petOwnerId(this.connection.adminMap);
    this.view.catalog.render({
      kind: this.selection.kind,
      selectedId: this.selection.defId,
      availableIds,
      ...(petPlacementDisabled ? { disabledIds: availableIds } : {}),
      ...(petPlacementDisabled ? { notice: "Select a connected player on this map to place a pet." } : {}),
      disabled: !this.connection.adminAuthenticated,
      onSelectKind: (kind) => this.selectCatalogKind(kind),
      onSelect: (definitionId) => this.selectCatalogDefinition(definitionId),
    });
  }

  private selectCatalogKind(kind: AdminSpawnSelection["kind"]): void {
    this.selection = selectionForAdminSpawnKind(this.selections, kind);
    this.render();
  }

  private selectCatalogDefinition(definitionId: string): void {
    this.selection = { ...this.selection, defId: definitionId };
    this.selections = withAdminSpawnDefinition(this.selections, this.selection);
    this.render();
  }

  private canPlaceSelectedDefinition(): boolean {
    return this.selection.kind !== "pet" || this.petOwnerId(this.connection.adminMap) !== null;
  }

  private petOwnerId(map: AdminMap | null): string | null {
    return petOwnerForAdminMap(this.selectedPlayer(), map);
  }
}

interface PetSpawnInput {
  readonly map: AdminMap;
  readonly x: number;
  readonly y: number;
  readonly selection: AdminSpawnSelection;
}
