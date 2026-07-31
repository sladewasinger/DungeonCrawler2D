import type { AdminCommand } from "@dc2d/engine";

type CommandFactory = (playerId?: string) => AdminCommand | null;

export function commandForAdminAction(
  action: string,
  playerId?: string,
): AdminCommand | null {
  return commandFactories[action]?.(playerId) ?? null;
}

const commandFactories: Readonly<Record<string, CommandFactory>> = {
  "spectator-free": () => ({ op: "spectator", action: "start", mode: "free" }),
  "spectator-stop": () => ({ op: "spectator", action: "stop" }),
  "spectator-next": () => ({ op: "spectator", action: "cycle", direction: "next" }),
  "spectator-previous": () => ({ op: "spectator", action: "cycle", direction: "previous" }),
  list: () => ({ op: "list" }),
  track: playerCommand((playerId) => ({ op: "spectate", playerId })),
  spectate: playerCommand((playerId) => ({ op: "spectate", playerId })),
  "teleport-spawn": playerCommand((playerId) => ({ op: "teleport", playerId, destination: "spawn" })),
  "teleport-safe": playerCommand((playerId) => ({ op: "teleport", playerId, destination: "safeRoom" })),
  heal: playerCommand((playerId) => ({ op: "heal", playerId })),
  kill: playerCommand((playerId) => ({ op: "kill", playerId })),
  "god-on": playerCommand((playerId) => ({ op: "god", playerId, enabled: true })),
  "god-off": playerCommand((playerId) => ({ op: "god", playerId, enabled: false })),
  "handicap-on": playerCommand((playerId) => ({ op: "handicap", playerId, enabled: true })),
  "handicap-off": playerCommand((playerId) => ({ op: "handicap", playerId, enabled: false })),
  "admin-on": playerCommand((playerId) => ({ op: "assignAdmin", playerId, enabled: true })),
  "admin-off": playerCommand((playerId) => ({ op: "assignAdmin", playerId, enabled: false })),
  "kill-enemies": playerCommand((centerPlayerId) => ({ op: "killEnemies", centerPlayerId, radius: 8 })),
};

function playerCommand(factory: (playerId: string) => AdminCommand): CommandFactory {
  return (playerId) => playerId ? factory(playerId) : null;
}
