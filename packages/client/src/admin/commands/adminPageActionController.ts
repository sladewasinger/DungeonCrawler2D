import type { Connection } from "../../net/connection/connection.js";
import type { AdminPageView } from "../adminPageView.js";
import type { AdminSpawnPlacementController } from "../adminSpawnPlacementController.js";
import type { AdminPlayerObserverController } from "../spectator/adminPlayerObserverController.js";
import { commandForAdminAction } from "./adminCommandFactory.js";
import { adminParameterizedCommand } from "./adminParameterizedCommand.js";

export interface AdminPageActionControllerOptions {
  readonly connection: Connection;
  readonly view: AdminPageView;
  readonly spawnPlacement: AdminSpawnPlacementController;
  readonly playerObserver: AdminPlayerObserverController;
}

export class AdminPageActionController {
  constructor(private readonly options: AdminPageActionControllerOptions) {}

  send(action: string, control: HTMLButtonElement | null): void {
    if (action === "spectator-center") return this.options.playerObserver.centerCamera();
    if (this.sendMapAction(action)) return;
    const parameterized = adminParameterizedCommand(action, control);
    if (parameterized.recognized) return this.sendParameterized(parameterized);
    const command = commandForAdminAction(action, control?.dataset.playerId);
    if (command) this.options.connection.sendAdminCommand(command);
  }

  private sendMapAction(action: string): boolean {
    if (action === "inspect-map") this.options.spawnPlacement.inspectCurrentMap();
    else if (action === "map-center-selected") {
      this.options.spawnPlacement.followPlayer(this.options.playerObserver.selectedPlayer());
    } else if (action === "map-free-camera") this.options.spawnPlacement.freeCamera();
    else return false;
    return true;
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
