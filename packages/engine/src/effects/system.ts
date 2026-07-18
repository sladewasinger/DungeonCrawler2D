import type { Entity } from "../entities/entity.js";
import type { Primitive, ContentRegistry } from "./types.js";
import type { EffectEvent } from "./events.js";
import { modifyHealth, type DamageOpts, type EffectTarget } from "./health.js";
import { applyStatus, removeStatusesByTag, runInteractionRules, runPrimitives } from "./resolve.js";
import { inSanctuary, tagsOf, type EffectsState } from "./state.js";
import { speedMult, tick } from "./tick.js";

export type { EffectEvent } from "./events.js";
export type { DamageOpts, EffectTarget } from "./health.js";

/**
 * The server-authoritative effects engine (Epic 3) facade. Statuses
 * are data; this system executes their primitives, enforces
 * stacking/immunity/sanctuary rules, and emits events the sim
 * broadcasts to clients — clients render outcomes, they never
 * compute them. Orchestrates the sibling modules in this folder;
 * consumers use this class, never the siblings directly.
 */
export class EffectsEngine {
  private readonly state: EffectsState;

  constructor(content: ContentRegistry, isSanctuaryAt: (x: number, y: number) => boolean) {
    this.state = { content, isSanctuaryAt };
  }

  tagsOf(entity: Entity): Set<string> {
    return tagsOf(this.state, entity);
  }

  inSanctuary(entity: Entity): boolean {
    return inSanctuary(this.state, entity);
  }

  modifyHealth(
    entity: Entity,
    amount: number,
    events: EffectEvent[],
    opts: DamageOpts = {},
    target: EffectTarget = {},
  ): number {
    return modifyHealth(this.state, entity, amount, events, opts, target);
  }

  applyStatus(
    entity: Entity,
    statusId: string,
    events: EffectEvent[],
    target: EffectTarget = {},
  ): boolean {
    return applyStatus(this.state, entity, statusId, events, target);
  }

  removeStatusesByTag(entity: Entity, tag: string, events: EffectEvent[]): void {
    removeStatusesByTag(this.state, entity, tag, events);
  }

  tick(
    entity: Entity,
    dt: number,
    events: EffectEvent[],
    target: EffectTarget = {},
    rng: () => number = Math.random,
  ): void {
    tick(this.state, entity, dt, events, target, rng);
  }

  speedMult(entity: Entity): number {
    return speedMult(this.state, entity);
  }

  runInteractionRules(entity: Entity, events: EffectEvent[]): void {
    runInteractionRules(this.state, entity, events);
  }

  runPrimitives(
    entity: Entity,
    primitives: readonly Primitive[],
    events: EffectEvent[],
    target: EffectTarget = {},
    rng: () => number = Math.random,
    sourceTags?: readonly string[],
  ): void {
    runPrimitives(this.state, entity, primitives, events, target, rng, sourceTags);
  }
}
