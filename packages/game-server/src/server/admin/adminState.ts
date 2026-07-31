import {
  createDebugFlags,
  type AdminObserverState,
  type AdminPlayer,
  type AdminState,
} from "@dc2d/engine";
import type { FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import type { AdminSession } from "./access/authorization.js";
import type { SpectatorSession } from "./spectator/spectatorSession.js";
import { mapForInspector, mapForTrackedSpectator } from "./worldCommands.js";

export interface AdminStateInput {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly spectator: SpectatorSession;
  readonly session: AdminSession | null;
  readonly players: readonly AdminPlayer[];
}

export function buildAdminState(input: AdminStateInput): AdminState {
  const observer = buildAdminObserverState(input);
  return {
    type: "adminState",
    players: observer.players,
    spectator: observer.spectator,
    map: mapForInspector(
      { floors: input.floors, sandbox: input.sandbox },
      input.spectator,
      input.players,
    ),
    spectatorMap: observer.spectatorMap,
    palette: input.sandbox.admin.palette(),
    debug: input.session?.debugFlags ?? createDebugFlags(),
  };
}

export function buildAdminObserverState(input: AdminStateInput): AdminObserverState {
  return {
    type: "adminObserverState",
    players: [...input.players],
    spectator: {
      mode: input.spectator.mode,
      playerId: input.spectator.playerId,
    },
    spectatorMap: mapForTrackedSpectator(
      { floors: input.floors, sandbox: input.sandbox },
      input.spectator,
      input.players,
    ),
  };
}
