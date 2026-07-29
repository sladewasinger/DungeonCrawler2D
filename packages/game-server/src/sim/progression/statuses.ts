import { TICK_DT, type EffectEvent } from "@dc2d/engine";
import { combatants, effectTargetFor } from "../core/helpers.js";
import type { SimState } from "../state/state.js";
import { igniteEntity } from "./elemental/elementalIgnition.js";
import {
  fireSourceForEntity,
  resolveFireContact,
} from "./elemental/fireContact.js";
export { realizeEffectEvents } from "./effectEvents.js";

/** Area-contact statuses, status ticking, and effect-event realization. */

const ITEM_CHAR_SECONDS = 3;

export function applyAreaContact(sim: SimState, effectEvents: EffectEvent[]): void {
  applyGroundStatuses(sim, effectEvents);
  charItemsInFire(sim);
}

/** Entities standing on a status-tagged ground area (fire, poison gas…) catch it. */
function applyGroundStatuses(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const entity of combatants(sim)) applyGroundStatus(sim, entity, effectEvents);
}

function applyGroundStatus(sim: SimState, entity: ReturnType<typeof combatants>[number], effectEvents: EffectEvent[]): void {
  if (entity.hp <= 0) return;
  if (!entity.body.grounded) return;
  igniteOilUnderBurningEntity(sim, entity, effectEvents);
  const contacts = groundStatusesAt(sim, entity.body.x, entity.body.y);
  for (const contact of contacts) {
    applyGroundContact({ sim, entity, contact, effectEvents });
  }
}

interface GroundContactRequest {
  readonly sim: SimState;
  readonly entity: ReturnType<typeof combatants>[number];
  readonly contact: { statusId: string; sourceId?: string };
  readonly effectEvents: EffectEvent[];
}

function applyGroundContact({ sim, entity, contact, effectEvents }: GroundContactRequest): void {
  if (contact.statusId === "on-fire") {
    igniteEntity({ sim, entity, effectEvents, ...sourceOption(contact.sourceId) });
    return;
  }
  sim.effects.applyStatus({
    entity,
    statusId: contact.statusId,
    events: effectEvents,
    target: effectTargetFor(sim, entity),
    ...sourceOption(contact.sourceId),
  });
}

function sourceOption(sourceId: string | undefined): { sourceId?: string } {
  return sourceId === undefined ? {} : { sourceId };
}

function igniteOilUnderBurningEntity(
  sim: SimState,
  entity: ReturnType<typeof combatants>[number],
  effectEvents: EffectEvent[],
): boolean {
  const source = fireSourceForEntity(sim, entity);
  if (!source) return false;
  return resolveFireContact({
    sim,
    source,
    effectEvents,
    target: {
      kind: "area",
      x: Math.floor(entity.body.x),
      y: Math.floor(entity.body.y),
    },
  });
}

function groundStatusesAt(
  sim: SimState,
  x: number,
  y: number,
): Array<{ statusId: string; sourceId?: string }> {
  return sim.areas.contactsAt(Math.floor(x), Math.floor(y));
}

/** Ground items exposed to fire char over time, then are destroyed. */
function charItemsInFire(sim: SimState): void {
  for (const [id, item] of sim.items) charItemIfBurning(sim, id, item);
}

function charItemIfBurning(sim: SimState, id: string, item: SimState["items"] extends Map<string, infer Item> ? Item : never): void {
  if (!sim.areas.hasTagAt(Math.floor(item.body.x), Math.floor(item.body.y), "fire")) {
    sim.exposure.delete(id);
    return;
  }
  const total = (sim.exposure.get(id) ?? 0) + TICK_DT;
  if (total >= ITEM_CHAR_SECONDS) return destroyCharredItem(sim, id);
  sim.exposure.set(id, total);
}

function destroyCharredItem(sim: SimState, id: string): void {
  sim.items.delete(id);
  sim.exposure.delete(id);
}

export function tickStatuses(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const entity of combatants(sim)) {
    if (entity.hp <= 0) continue;
    sim.effects.tick({ entity, dt: TICK_DT, events: effectEvents, target: effectTargetFor(sim, entity), rng: () => sim.rng.next() });
    sim.effects.runInteractionRules({ entity, events: effectEvents });
  }
}
