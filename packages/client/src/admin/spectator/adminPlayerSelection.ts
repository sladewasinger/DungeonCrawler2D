import type { AdminPlayer } from "@dc2d/engine";

export interface AdminPlayerSelectionState {
  readonly players: readonly AdminPlayer[];
  readonly spectatorMode: "off" | "free" | "track";
  readonly spectatorTargetId: string | null;
}

export class AdminPlayerSelection {
  private playerId: string | null = null;

  select(playerId: string): void {
    this.playerId = playerId;
  }

  sync(state: AdminPlayerSelectionState): void {
    if (!this.selectedPlayer(state.players)) this.playerId = null;
    if (!this.playerId && tracksConnectedPlayer(state)) {
      this.playerId = state.spectatorTargetId;
    }
  }

  selectedPlayer(players: readonly AdminPlayer[]): AdminPlayer | null {
    if (!this.playerId) return null;
    return players.find((player) => player.playerId === this.playerId) ?? null;
  }

  get selectedPlayerId(): string | null {
    return this.playerId;
  }
}

function tracksConnectedPlayer(state: AdminPlayerSelectionState): boolean {
  return state.spectatorMode === "track" && state.spectatorTargetId !== null &&
    state.players.some((player) => player.playerId === state.spectatorTargetId);
}

export function playerIdFromSelectionEvent(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const row = target.closest<HTMLElement>("[data-admin-player-select]");
  return row?.dataset.playerId ?? null;
}
