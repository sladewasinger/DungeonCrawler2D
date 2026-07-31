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
    this.clearMissingSelection(state.players);
    if (!tracksConnectedPlayer(state)) return;
    this.playerId = state.spectatorTargetId;
  }

  selectedPlayer(players: readonly AdminPlayer[]): AdminPlayer | null {
    if (!this.playerId) return null;
    return players.find((player) => player.playerId === this.playerId) ?? null;
  }

  get selectedPlayerId(): string | null {
    return this.playerId;
  }

  private clearMissingSelection(players: readonly AdminPlayer[]): void {
    if (this.selectedPlayer(players)) return;
    this.playerId = null;
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
