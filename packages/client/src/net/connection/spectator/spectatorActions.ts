import { ConnectionActions } from "../ConnectionActions.js";
import type { Connection } from "../connection.js";
import { openSocket } from "../socket.js";

export class ConnectionSpectatorActions extends ConnectionActions {
  private get spectatorConnection(): Connection {
    return this as unknown as Connection;
  }

  connectSpectator(mode: "free" | "track" = "free", playerId?: string): void {
    this.adminOnly = false;
    this.spectatorOnly = true;
    this.spectatorRequestedMode = mode;
    this.spectatorRequestedTargetId = playerId ?? null;
    this.spectatorMode = mode;
    openSocket(this.spectatorConnection);
  }

  setSpectatorMode(mode: "free" | "track"): void {
    this.spectatorRequestedMode = mode;
    this.spectatorConnection.send({ type: "spectatorCommand", action: "mode", mode });
  }

  selectSpectatorTarget(playerId: string): void {
    this.spectatorRequestedTargetId = playerId;
    this.spectatorConnection.send({ type: "spectatorCommand", action: "target", playerId });
  }

  cycleSpectator(direction: "next" | "previous"): void {
    this.spectatorConnection.send({ type: "spectatorCommand", action: "cycle", direction });
  }
}
