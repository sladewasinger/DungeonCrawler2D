import type { ServerMessage } from "@dc2d/engine";
import type { Connection } from "../connection.js";
import { applySpectatorWelcome } from "../welcome.js";

export function handleSpectatorMessage(
  connection: Connection,
  message: ServerMessage,
): boolean {
  if (message.type === "spectatorWelcome") {
    applySpectatorWelcome(connection, message);
    connection.onSpectatorState?.();
    return true;
  }
  if (message.type === "spectatorPresentation") {
    connection.spectatorDeathPresentations.ingest(message);
    return true;
  }
  if (message.type !== "spectatorRoster") return false;
  connection.spectatorPlayers = message.players;
  connection.spectatorTargetId = message.playerId;
  connection.spectatorMode = message.mode;
  connection.onSpectatorState?.();
  return true;
}
