import type { Connection } from "../../net/connection/connection.js";
import type { AdminPageView } from "../adminPageView.js";
import { renderAdminPlayers } from "../players/adminPlayerTable.js";
import {
  AdminPlayerSelection,
  playerIdFromSelectionEvent,
} from "./adminPlayerSelection.js";

export class AdminPlayerObserverController {
  private readonly selection = new AdminPlayerSelection();

  constructor(
    private readonly connection: Connection,
    private readonly view: AdminPageView,
  ) {}

  select(target: EventTarget | null): boolean {
    const playerId = playerIdFromSelectionEvent(target);
    if (!playerId) return false;
    this.selection.select(playerId);
    return true;
  }

  selectFromKey(event: KeyboardEvent): boolean {
    if (event.key !== "Enter" && event.key !== " ") return false;
    if (!this.select(event.target)) return false;
    event.preventDefault();
    return true;
  }

  selectedPlayer() {
    return this.selection.selectedPlayer(this.connection.adminPlayers);
  }

  centerCamera(): void {
    this.view.playerObserver.centerCamera();
  }

  zoomCamera(direction: "in" | "out"): void {
    this.view.playerObserver.zoomCamera(direction);
  }

  render(): void {
    this.selection.sync({
      players: this.connection.adminPlayers,
      spectatorMode: this.connection.spectatorMode,
      spectatorTargetId: this.connection.spectatorTargetId,
    });
    this.renderPlayers();
    this.renderObserver();
  }

  private renderPlayers(): void {
    renderAdminPlayers({
      playersElement: this.view.players,
      players: this.connection.adminPlayers,
      authenticated: this.connection.adminAuthenticated,
      selectedPlayerId: this.selection.selectedPlayerId,
    });
  }

  private renderObserver(): void {
    const spectatorPlayer = this.connection.adminPlayers.find(
      (player) => player.playerId === this.connection.spectatorTargetId,
    ) ?? null;
    this.view.playerObserver.render({
      player: this.selection.selectedPlayer(this.connection.adminPlayers),
      spectatorPlayer,
      authenticated: this.connection.adminAuthenticated,
      spectatorMode: this.connection.spectatorMode,
      spectatorTargetId: this.connection.spectatorTargetId,
      spectatorMap: this.connection.adminSpectatorMap,
    });
  }
}
