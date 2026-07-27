import type { Entity } from "../entities/entity.js";
import type { ContentRegistry } from "./types.js";
import type { EffectEvent } from "./events.js";
import { modifyHealth, type EffectTarget, type HealthChange } from "./health.js";
import { applyStatus, removeStatusesByTag, runInteractionRules, runPrimitives, type PrimitiveRun } from "./resolve.js";
import { inSanctuary, tagsOf, type EffectsState } from "./state.js";
import { speedMult, tick, type EffectsTick } from "./tick.js";

export type { EffectEvent } from "./events.js";
export type { DamageOpts, EffectTarget } from "./health.js";

export interface StatusChange {
  readonly entity: Entity;
  readonly statusId: string;
  readonly events: EffectEvent[];
  readonly target?: EffectTarget;
}

export interface StatusRemoval {
  readonly entity: Entity;
  readonly tag: string;
  readonly events: EffectEvent[];
}

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

  modifyHealth(change: HealthChange): number {
    return modifyHealth(this.state, change);
  }

  applyStatus(change: StatusChange): boolean {
    return applyStatus(this.state, change);
  }

  removeStatusesByTag(removal: StatusRemoval): void {
    removeStatusesByTag(this.state, removal);
  }

  tick(request: EffectsTick): void {
    tick(this.state, request);
  }

  speedMult(entity: Entity): number {
    return speedMult(this.state, entity);
  }

  runInteractionRules(request: Pick<StatusRemoval, "entity" | "events">): void {
    runInteractionRules(this.state, request);
  }

  runPrimitives(request: PrimitiveRun): void {
    runPrimitives(this.state, request);
  }
}
