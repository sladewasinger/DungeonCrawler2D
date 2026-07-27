import { TICK_DT, type EffectEvent } from "@dc2d/engine";
import { combatants, effectTargetFor, positionOf } from "./helpers.js";
import type { SimState } from "./state.js";

/** Area-contact statuses, status ticking, and effect-event realization. */

const ITEM_CHAR_SECONDS = 3;

export function applyAreaContact(sim: SimState, effectEvents: EffectEvent[]): void {
  applyGroundStatuses(sim, effectEvents);
  charItemsInFire(sim);
}

/** Entities standing on a status-tagged ground area (fire, poison gas…) catch it. */
function applyGroundStatuses(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const entity of combatants(sim)) {
    if (entity.hp <= 0 || !entity.body.grounded) continue; // fly over ground effects
    const tileX = Math.floor(entity.body.x);
    const tileY = Math.floor(entity.body.y);
    const defId = sim.areas.defAt(tileX, tileY);
    if (!defId) continue;
    const area = sim.content.areas.get(defId);
    if (!area?.onEnterStatus) continue;
    sim.effects.applyStatus(entity, area.onEnterStatus, effectEvents, effectTargetFor(sim, entity));
  }
}

/** Ground items exposed to fire char over time, then are destroyed. */
function charItemsInFire(sim: SimState): void {
  for (const [id, item] of sim.items) {
    const burning = sim.areas.hasTagAt(Math.floor(item.body.x), Math.floor(item.body.y), "fire");
    if (!burning) {
      sim.exposure.delete(id);
      continue;
    }
    const total = (sim.exposure.get(id) ?? 0) + TICK_DT;
    if (total >= ITEM_CHAR_SECONDS) {
      sim.items.delete(id);
      sim.exposure.delete(id);
    } else {
      sim.exposure.set(id, total);
    }
  }
}

export function tickStatuses(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const entity of combatants(sim)) {
    if (entity.hp <= 0) continue;
    sim.effects.tick(entity, TICK_DT, effectEvents, effectTargetFor(sim, entity), () =>
      sim.rng.next(),
    );
    sim.effects.runInteractionRules(entity, effectEvents);
  }
}

function healthEventFor(event: Extract<EffectEvent, { t: "hp" }>) {
  return {
    t: "health" as const,
    id: event.id,
    delta: event.delta,
    kind: event.delta > 0 ? "heal" as const : "damage" as const,
    ...(event.source === undefined ? {} : { source: event.source }),
  };
}

function realizeHealthEvent(
  sim: SimState,
  event: Extract<EffectEvent, { t: "hp" }>,
): void {
  const position = positionOf(sim, event.id);
  sim.worldEvents.push({ ev: healthEventFor(event), ...position });
  if (event.delta < 0) {
    sim.worldEvents.push({
      ev: { t: "damageImpact", id: event.id, amount: -event.delta },
      ...position,
    });
  }
}

/** Turn engine effect events into world state changes + replicated events. */
export function realizeEffectEvents(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const event of effectEvents) {
    switch (event.t) {
      case "spawnArea":
        sim.areas.spawn(event.area, event.x, event.y, event.radius);
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
        // handled in deaths.ts resolveDeaths (entity still present here)
        break;
    }
  }
}
