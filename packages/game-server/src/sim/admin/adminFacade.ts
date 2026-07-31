import type {
  AdminCommand,
  AdminMap,
  AdminPalette,
  AdminPlayer,
  DebugFlags,
} from "@dc2d/engine";
import { adminPlayers, executeAdminMutation, type AdminMutationResult } from "./adminControls.js";
import { adminMap, adminPalette, type AdminMapRequest } from "./adminMap.js";
import type { SimState } from "../state/state.js";

export interface GameAdminFacade {
  readonly players: () => AdminPlayer[];
  readonly map: (request: AdminMapRequest) => AdminMap;
  readonly palette: () => AdminPalette;
  readonly execute: (command: AdminCommand, operatorPlayerId: string | null) => AdminMutationResult;
  readonly isActiveAdmin: (playerId: string) => boolean;
  readonly setDebugFlags: (playerId: string, flags: DebugFlags) => boolean;
}

export function createGameAdminFacade(state: SimState): GameAdminFacade {
  return {
    players: () => adminPlayers(state),
    map: (request) => adminMap(state, request),
    palette: () => adminPalette(state),
    execute: (command, operatorPlayerId) => executeAdminMutation(state, command, operatorPlayerId),
    isActiveAdmin: (playerId) => state.players.get(playerId)?.admin === true,
    setDebugFlags: (playerId, flags) => setDebugFlags(state, playerId, flags),
  };
}

function setDebugFlags(state: SimState, playerId: string, flags: DebugFlags): boolean {
  const slot = state.players.get(playerId);
  if (!slot?.admin) return false;
  slot.debugFlags = { ...flags };
  return true;
}
