import type { SpectatorDirectory } from "./spectatorDirectory.js";
import {
  cycleTargetId,
  type SpectatorSubscription,
} from "./spectatorSubscriptionTypes.js";

export function selectInitialSpectatorTarget(
  directory: SpectatorDirectory,
  requested?: string,
): string | null {
  if (requested && directory.has(requested)) return requested;
  return directory.players()[0]?.playerId ?? null;
}

export function refreshSpectatorSubscription(input: SpectatorRefreshInput): void {
  retryBaseline(input.subscription, input.directory, input.now);
  const playerId = input.subscription.playerId;
  if (!playerId || !input.directory.has(playerId)) {
    input.subscription.playerId = selectInitialSpectatorTarget(input.directory);
    return input.sendTarget();
  }
  if (input.directory.worldIdentity(playerId) !== input.subscription.worldIdentity) {
    return input.sendTarget();
  }
  input.sendRoster();
}

export interface SpectatorRefreshInput {
  readonly subscription: SpectatorSubscription;
  readonly directory: SpectatorDirectory;
  readonly now: number;
  readonly sendTarget: () => void;
  readonly sendRoster: () => void;
}

export function cycleSpectatorTarget(input: SpectatorCycleInput): void {
  const ids = input.directory.players().map(({ playerId }) => playerId);
  input.subscription.playerId = cycleTargetId(ids, input.subscription.playerId, input.direction);
  if (!input.subscription.playerId) return input.sendRoster();
  input.sendTarget();
}

export interface SpectatorCycleInput {
  readonly subscription: SpectatorSubscription;
  readonly directory: SpectatorDirectory;
  readonly direction: "next" | "previous";
  readonly sendTarget: () => void;
  readonly sendRoster: () => void;
}

function retryBaseline(
  subscription: SpectatorSubscription,
  directory: SpectatorDirectory,
  now: number,
): void {
  if (!subscription.needsBaseline || !subscription.playerId) return;
  subscription.needsBaseline = !directory.requestBaseline(subscription.playerId, now);
}
