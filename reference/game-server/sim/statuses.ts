import { TICK_DT, type EffectEvent } from "@dc2d/engine";
import { combatants, effectTargetFor, positionOf } from "./helpers";
import type { SimState } from "./state";

/** Area-contact statuses, status ticking, and effect-event realization. */

const ITEM_CHAR_SECONDS = 3;

export function applyAreaContact(sim: SimState, effectEvents: EffectEvent[]): void {
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
  // Items exposed to fire char, then are destroyed.
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
        sim.worldEvents.push({
          ev: { t: "hit", id: event.id, amount: event.delta },
          ...positionOf(sim, event.id),
        });
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
