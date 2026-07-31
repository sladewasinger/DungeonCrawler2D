import type {
  AdminHistoryEntry,
  AdminObserverState,
  AdminPlayer,
  AdminState,
} from "@dc2d/engine";
import type { FloorRegistry } from "../../../floors/floorRegistry.js";
import type { GameSim } from "../../../sim/core/index.js";
import type { AdminSession } from "../access/authorization.js";
import { buildAdminObserverState, buildAdminState } from "../adminState.js";
import type { SpectatorSession } from "../spectator/spectatorSession.js";

export interface ControllerStateInput {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly combatSandbox: GameSim | undefined;
  readonly spectator: SpectatorSession;
  readonly session: AdminSession | null;
  readonly players: AdminPlayer[];
  readonly history: readonly AdminHistoryEntry[];
}

export function controllerAdminState(input: ControllerStateInput): AdminState {
  return buildAdminState(input);
}

export function controllerObserverState(
  input: Omit<ControllerStateInput, "session" | "history">,
): AdminObserverState {
  return buildAdminObserverState({ ...input, session: null, history: [] });
}
