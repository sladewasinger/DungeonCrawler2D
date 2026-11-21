import type { GameSim } from "../sim/core/index.js";

export function collectSnapshots<T>(
  active: readonly GameSim[],
  step: (sim: GameSim) => Map<string, T>,
): Map<string, T> {
  const snapshots = new Map<string, T>();
  for (const sim of active) {
    for (const [id, snapshot] of step(sim)) snapshots.set(id, snapshot);
  }
  return snapshots;
}

/** Relay each floor's global-chat events to every OTHER active floor. */
export function relayGlobalChat(active: readonly GameSim[]): void {
  const perSim = active.map((sim) => ({ sim, events: sim.takePendingGlobalChat() }));
  for (const origin of perSim) relayOriginChat(origin, perSim);
}

type ChatRelaySource = { sim: GameSim; events: ReturnType<GameSim["takePendingGlobalChat"]> };

function relayOriginChat(origin: ChatRelaySource, destinations: ChatRelaySource[]): void {
  if (origin.events.length === 0) return;
  for (const destination of destinations) relayToOtherSim(origin, destination);
}

function relayToOtherSim(origin: ChatRelaySource, destination: ChatRelaySource): void {
  if (destination.sim === origin.sim) return;
  for (const event of origin.events) destination.sim.injectGlobalChat(event, senderProfileIdFor(origin.sim, event));
}

function senderProfileIdFor(sim: GameSim, event: ChatRelaySource["events"][number]): string | undefined {
  return event.t === "chat" ? sim.profileIdForPlayer(event.from) : undefined;
}

/** Refresh every active floor's cross-floor /who directory. */
export function refreshDirectory(active: readonly GameSim[]): void {
  const directory = active.flatMap((sim) => sim.listConnectedPlayers());
  for (const sim of active) sim.setCrossFloorDirectory(directory);
}
