import type { Connection } from "../../net/connection/connection.js";
import type { AdminPageView } from "../adminPageView.js";
import type { AdminSpawnPlacementController } from "../adminSpawnPlacementController.js";
import type { AdminPlayerObserverController } from "../spectator/adminPlayerObserverController.js";
import {
  commandForAdminAction,
  commandForSpectatorToggle,
} from "./adminCommandFactory.js";
import { adminParameterizedCommand } from "./adminParameterizedCommand.js";
import {
  configureFreePanToggle,
  setFreePanToggle,
} from "../map/adminMapFreePan.js";

export interface AdminPageActionControllerOptions {
  readonly connection: Connection;
  readonly view: AdminPageView;
  readonly spawnPlacement: AdminSpawnPlacementController;
  readonly playerObserver: AdminPlayerObserverController;
}

export class AdminPageActionController {
  constructor(private readonly options: AdminPageActionControllerOptions) {}

  send(action: string, control: HTMLButtonElement | null): void {
    if (this.sendSpectatorAction(action)) return;
    if (this.sendMapAction(action, control)) return;
    const parameterized = adminParameterizedCommand(action, control);
    if (parameterized.recognized) return this.sendParameterized(parameterized);
    const command = commandForAdminAction(action, control?.dataset.playerId);
    if (command) this.options.connection.sendAdminCommand(command);
  }

  private sendSpectatorAction(action: string): boolean {
    if (action === "spectator-center") this.options.playerObserver.centerCamera();
    else if (action === "spectator-zoom-in") this.options.playerObserver.zoomCamera("in");
    else if (action === "spectator-zoom-out") this.options.playerObserver.zoomCamera("out");
    else if (action === "spectator-toggle") this.toggleSpectator();
    else return false;
    return true;
  }

  private toggleSpectator(): void {
    const command = commandForSpectatorToggle(this.options.connection.spectatorMode);
    this.options.connection.sendAdminCommand(command);
  }

  private sendMapAction(action: string, control: HTMLButtonElement | null): boolean {
    if (action === "inspect-map") this.options.spawnPlacement.inspectCurrentMap();
    else if (action === "map-center-selected") {
      this.options.spawnPlacement.followPlayer(this.options.playerObserver.selectedPlayer());
      setFreePanToggle(this.options.view.root, false);
    } else if (action === "map-free-camera") this.toggleFreePan(control);
    else if (action === "map-zoom-in") this.options.spawnPlacement.zoom("in");
    else if (action === "map-zoom-out") this.options.spawnPlacement.zoom("out");
    else if (action === "map-zoom-reset") this.options.spawnPlacement.resetZoom();
    else return false;
    return true;
  }

  private toggleFreePan(control: HTMLButtonElement | null): void {
    const enabled = control?.getAttribute("aria-checked") === "true";
    const nextEnabled = !enabled;
    this.options.spawnPlacement.toggleFreeCamera(nextEnabled);
    if (control) configureFreePanToggle(control, nextEnabled);
  }

  private sendParameterized(
    result: ReturnType<typeof adminParameterizedCommand>,
  ): void {
    if (result.command) this.options.connection.sendAdminCommand(result.command);
    else this.options.view.history.showCommandResult({
      ok: false,
      message: result.error ?? "Invalid admin command values.",
    });
  }
}
