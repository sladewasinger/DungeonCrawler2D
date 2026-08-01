import type { Connection } from "../../net/connection/connection.js";

const EMPTY_MESSAGE = "Nothing to spectate right now. Please wait for someone to join.";

export interface SpectatorAvailabilityInput {
  readonly playerIds: readonly string[];
  readonly targetId: string | null;
  readonly hasWorld: boolean;
}

export function spectatorPresentationAvailable(
  input: SpectatorAvailabilityInput,
): boolean {
  return input.hasWorld && input.targetId !== null &&
    input.playerIds.includes(input.targetId);
}

export class SpectatorAvailabilityView {
  private readonly message = document.createElement("strong");

  constructor(private readonly root: HTMLElement) {
    this.message.dataset.spectatorEmptyMessage = "";
    this.message.textContent = EMPTY_MESSAGE;
    this.message.setAttribute("role", "status");
    this.message.setAttribute("aria-live", "polite");
    root.append(this.message);
  }

  render(connection: Connection): void {
    const available = spectatorPresentationAvailable({
      playerIds: connection.spectatorPlayers.map(({ playerId }) => playerId),
      targetId: connection.spectatorTargetId,
      hasWorld: connection.world !== null,
    });
    this.root.dataset.spectatorAvailability = available ? "active" : "empty";
    this.message.hidden = available;
  }

  dispose(): void {
    delete this.root.dataset.spectatorAvailability;
    this.message.remove();
  }
}
