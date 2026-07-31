import type { AdminCommand, AdminPlayer } from "@dc2d/engine";
import {
  setFreeSpectator,
  stopSpectator,
  trackSpectator,
  type SpectatorSession,
} from "./spectatorSession.js";

export interface SpectatorCommandResult {
  readonly handled: boolean;
  readonly ok: boolean;
  readonly code?: string;
}

export function executeSpectatorCommand(
  spectator: SpectatorSession,
  command: AdminCommand,
  players: readonly AdminPlayer[],
): SpectatorCommandResult {
  if (command.op === "spectate") return track(spectator, command.playerId, players);
  if (command.op !== "spectator") return { handled: false, ok: false };
  if (command.action === "stop") {
    stopSpectator(spectator);
    return { handled: true, ok: true };
  }
  if (command.action === "start") return start(spectator, command, players);
  return cycle(spectator, command.direction ?? "next", players);
}

function track(
  spectator: SpectatorSession,
  playerId: string | null,
  players: readonly AdminPlayer[],
): SpectatorCommandResult {
  if (playerId && !players.some((player) => player.playerId === playerId)) {
    return { handled: true, ok: false, code: "player_not_found" };
  }
  trackSpectator(spectator, playerId);
  return { handled: true, ok: true };
}

function start(
  spectator: SpectatorSession,
  command: Extract<AdminCommand, { op: "spectator" }>,
  players: readonly AdminPlayer[],
): SpectatorCommandResult {
  if (command.mode === "track") return track(spectator, command.playerId ?? null, players);
  setFreeSpectator(spectator);
  return { handled: true, ok: true };
}

function cycle(
  spectator: SpectatorSession,
  direction: "next" | "previous",
  players: readonly AdminPlayer[],
): SpectatorCommandResult {
  if (players.length === 0) return { handled: true, ok: false, code: "no_players" };
  const current = players.findIndex((player) => player.playerId === spectator.playerId);
  const step = direction === "next" ? 1 : -1;
  const index = current < 0
    ? (direction === "next" ? 0 : players.length - 1)
    : (current + step + players.length) % players.length;
  trackSpectator(spectator, players[index]!.playerId);
  return { handled: true, ok: true };
}
