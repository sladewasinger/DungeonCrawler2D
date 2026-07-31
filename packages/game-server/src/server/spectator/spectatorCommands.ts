import type { ClientSpectatorCommand } from "@dc2d/engine";
import type { SpectatorDirectory } from "./spectatorDirectory.js";
import type { SpectatorSubscription } from "./spectatorSubscriptionTypes.js";

const TARGET_CHANGE_COOLDOWN_MS = 400;

export function applySpectatorCommand(input: {
  readonly subscription: SpectatorSubscription;
  readonly command: ClientSpectatorCommand;
  readonly directory: SpectatorDirectory;
  readonly now: number;
  readonly sendTarget: () => void;
  readonly sendRoster: () => void;
  readonly cycle: (direction: "next" | "previous") => void;
}): void {
  if (input.command.action === "mode") return applyMode(input);
  if (input.command.action === "target") return applyTarget(input);
  applyCycle(input);
}

function applyMode(input: Parameters<typeof applySpectatorCommand>[0]): void {
  if (!input.command.mode) return;
  input.subscription.mode = input.command.mode;
  input.sendRoster();
}

function applyTarget(input: Parameters<typeof applySpectatorCommand>[0]): void {
  const playerId = input.command.playerId;
  if (!playerId || !input.directory.has(playerId)) return;
  if (playerId === input.subscription.playerId) return trackCurrent(input);
  if (input.now - input.subscription.lastTargetChangeAt < TARGET_CHANGE_COOLDOWN_MS) return;
  input.subscription.lastTargetChangeAt = input.now;
  input.subscription.playerId = playerId;
  input.subscription.mode = "track";
  input.sendTarget();
}

function trackCurrent(input: Parameters<typeof applySpectatorCommand>[0]): void {
  input.subscription.mode = "track";
  input.sendRoster();
}

function applyCycle(input: Parameters<typeof applySpectatorCommand>[0]): void {
  if (input.now - input.subscription.lastTargetChangeAt < TARGET_CHANGE_COOLDOWN_MS) return;
  input.subscription.lastTargetChangeAt = input.now;
  input.cycle(input.command.direction ?? "next");
}
