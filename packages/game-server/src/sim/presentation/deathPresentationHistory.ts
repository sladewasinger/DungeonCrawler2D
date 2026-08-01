import {
  AOI_RADIUS,
  TICK_RATE,
  type SpectatorDeathPresentation,
} from "@dc2d/engine";
import type { SimState } from "../state/state.js";

export const DEATH_PRESENTATION_TTL_TICKS = 60 * TICK_RATE;
export const DEATH_PRESENTATION_HISTORY_CAP = 24;

export function recordDeathPresentation(
  sim: SimState,
  presentation: Omit<SpectatorDeathPresentation, "occurredAtTick">,
): void {
  sim.deathPresentationHistory.push({
    ...presentation,
    occurredAtTick: sim.tickCount,
  });
  pruneDeathPresentationHistory(sim);
}

export function pruneDeathPresentationHistory(sim: SimState): void {
  const oldestTick = sim.tickCount - DEATH_PRESENTATION_TTL_TICKS;
  const active = sim.deathPresentationHistory.filter(
    ({ occurredAtTick }) => occurredAtTick > oldestTick,
  );
  sim.deathPresentationHistory.splice(
    0,
    sim.deathPresentationHistory.length,
    ...active.slice(-DEATH_PRESENTATION_HISTORY_CAP),
  );
}

export function visibleDeathPresentationHistory(
  sim: SimState,
  playerId: string,
): SpectatorDeathPresentation[] {
  pruneDeathPresentationHistory(sim);
  const body = sim.players.get(playerId)?.entity.body;
  if (!body) return [];
  return sim.deathPresentationHistory.filter(({ x, y }) =>
    Math.hypot(x - body.x, y - body.y) <= AOI_RADIUS
  );
}
