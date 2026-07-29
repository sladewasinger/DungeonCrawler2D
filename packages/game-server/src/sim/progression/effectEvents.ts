import type { EffectEvent } from "@dc2d/engine";
import { positionOf } from "../core/helpers.js";
import type { SimState } from "../state/state.js";

function healthEventFor(event: Extract<EffectEvent, { t: "hp" }>) {
  return {
    t: "health" as const,
    id: event.id,
    delta: event.delta,
    kind: event.delta > 0 ? "heal" as const : "damage" as const,
    ...(event.source === undefined ? {} : { source: event.source }),
    ...(event.sourceId === undefined ? {} : { sourceId: event.sourceId }),
  };
}

function realizeHealthEvent(
  sim: SimState,
  event: Extract<EffectEvent, { t: "hp" }>,
): void {
  recordDamageSource(sim, event);
  const position = positionOf(sim, event.id);
  sim.worldEvents.push({ ev: healthEventFor(event), ...position });
  if (event.delta < 0) {
    sim.worldEvents.push({
      ev: { t: "damageImpact", id: event.id, amount: -event.delta },
      ...position,
    });
  }
}

function recordDamageSource(
  sim: SimState,
  event: Extract<EffectEvent, { t: "hp" }>,
): void {
  if (event.delta >= 0 || event.sourceId === undefined) return;
  const enemy = sim.enemies.get(event.id);
  if (enemy) enemy.lastDamageSourceId = event.sourceId;
  const player = sim.players.get(event.id);
  if (!player) return;
  player.lastDamageSourceId = event.sourceId;
  if (sim.players.has(event.sourceId)) player.lastDamagedByPlayerId = event.sourceId;
}

/** Turn engine effect events into authoritative world state changes. */
export function realizeEffectEvents(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const event of effectEvents) realizeEffectEvent(sim, event);
}

function realizeEffectEvent(sim: SimState, event: EffectEvent): void {
  switch (event.t) {
    case "spawnArea":
      sim.areas.spawn({
        defId: event.area,
        x: event.x,
        y: event.y,
        radius: event.radius,
        ...(event.sourceId === undefined ? {} : { sourceId: event.sourceId }),
      });
      break;
    case "destroy":
      sim.items.delete(event.id);
      sim.projectiles.delete(event.id);
      break;
    case "hp":
      realizeHealthEvent(sim, event);
      break;
    case "status":
      sim.worldEvents.push({
        ev: { t: "status", id: event.id, status: event.status, on: event.on },
        ...positionOf(sim, event.id),
      });
      break;
    case "death":
      break;
  }
}
