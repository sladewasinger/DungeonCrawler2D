import type { AdminCommand } from "@dc2d/engine";

export function commandTargetId(command: AdminCommand): string | undefined {
  if (command.op === "killEnemies") return command.centerPlayerId;
  if (command.op === "teleport" || command.op === "kill" || command.op === "heal" ||
    command.op === "god" || command.op === "handicap" || command.op === "assignAdmin") {
    return command.playerId;
  }
  return undefined;
}

export function commandTargetIds(command: AdminCommand): string[] {
  return [...new Set(relatedTargetIds(command))];
}

function relatedTargetIds(command: AdminCommand): string[] {
  return [
    commandTargetId(command),
    command.op === "despawn" ? command.entityId : undefined,
    command.op === "teleport" ? command.targetPlayerId : undefined,
    command.op === "spectate" ? command.playerId : undefined,
    command.op === "spectator" ? command.playerId : undefined,
  ].filter((targetId): targetId is string => Boolean(targetId));
}
