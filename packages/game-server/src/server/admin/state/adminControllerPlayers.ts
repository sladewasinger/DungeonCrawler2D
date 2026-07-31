import type { AdminPlayer } from "@dc2d/engine";
import type { FloorRegistry } from "../../../floors/floorRegistry.js";
import type { GameSim } from "../../../sim/core/index.js";

export interface AdminControllerWorldInput {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly combatSandbox: GameSim | undefined;
}

export function adminControllerPlayers(input: AdminControllerWorldInput): AdminPlayer[] {
  return allAdminSims(input).flatMap((sim) => sim.admin.players());
}

export function simForAdminPlayer(
  input: AdminControllerWorldInput,
  playerId: string,
): GameSim | undefined {
  return allAdminSims(input)
    .find((sim) => sim.admin.players().some((player) => player.playerId === playerId));
}

function allAdminSims(input: AdminControllerWorldInput): readonly GameSim[] {
  return [
    ...input.floors.activeSims(),
    input.sandbox,
    ...(input.combatSandbox ? [input.combatSandbox] : []),
  ];
}

export function activeAdminSim(
  input: AdminControllerWorldInput,
  playerId: string,
): GameSim | undefined {
  const sim = simForAdminPlayer(input, playerId);
  return sim?.admin.isActiveAdmin(playerId) ? sim : undefined;
}
