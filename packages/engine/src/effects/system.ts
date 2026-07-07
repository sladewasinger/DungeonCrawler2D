import { entityTags, type Entity } from "../entities/entity";
import type { ContentRegistry, Primitive } from "./types";

/**
 * The server-authoritative effects engine (Epic 3). Statuses are data;
 * this system executes their primitives, enforces stacking/immunity/
 * sanctuary rules, and emits events the sim broadcasts to clients —
 * clients render outcomes, they never compute them.
 */

export type EffectEvent =
  | { t: "hp"; id: string; delta: number; hp: number }
  | { t: "status"; id: string; status: string; on: boolean }
  | { t: "death"; id: string }
  | { t: "destroy"; id: string }
  | { t: "spawnArea"; x: number; y: number; area: string; radius: number };

export interface DamageOpts {
  /** Tags describing the damage source (fire, physical, …). */
  sourceTags?: readonly string[];
  /** Sanctuary suppression bypass (falls, bleed-out — world rules). */
  ignoreSanctuary?: boolean;
}

export interface EffectTarget {
  /** Immunity tags from the entity's content definition. */
  immunities?: readonly string[];
  /** Damage multipliers by source tag. */
  damageScale?: Readonly<Record<string, number>>;
}

export class EffectsEngine {
  constructor(
    private readonly content: ContentRegistry,
    private readonly isSanctuaryAt: (x: number, y: number) => boolean,
  ) {}

  tagsOf(entity: Entity): Set<string> {
    return entityTags(entity, (defId) => this.content.statuses.get(defId)?.appliesTags);
  }

  inSanctuary(entity: Entity): boolean {
    return this.isSanctuaryAt(Math.floor(entity.body.x), Math.floor(entity.body.y));
  }

  /**
   * Damage/heal an entity. Hostile amounts are suppressed in sanctuary
   * and scaled by the target's damageScale per source tag. Emits hp
   * and death events. Returns the applied delta.
   */
  modifyHealth(
    entity: Entity,
    amount: number,
    events: EffectEvent[],
    opts: DamageOpts = {},
    target: EffectTarget = {},
  ): number {
    if (entity.hp <= 0) return 0;
    let delta = amount;
    if (delta < 0) {
      if (!opts.ignoreSanctuary && this.inSanctuary(entity)) return 0;
      if (target.damageScale && opts.sourceTags) {
        for (const tag of opts.sourceTags) {
          const scale = target.damageScale[tag];
          if (scale !== undefined) delta *= scale;
        }
      }
    }
    const before = entity.hp;
    entity.hp = Math.max(0, Math.min(entity.maxHp, entity.hp + delta));
    const applied = entity.hp - before;
    if (applied !== 0) events.push({ t: "hp", id: entity.id, delta: applied, hp: entity.hp });
    if (entity.hp <= 0) events.push({ t: "death", id: entity.id });
    return applied;
  }

  /**
   * Apply a status by id. Respects immunities (by status tag), stacking
   * rules, and sanctuary (debuffs are suppressed inside). Runs onApply
   * primitives and then the tag interaction rules.
   */
  applyStatus(
    entity: Entity,
    statusId: string,
    events: EffectEvent[],
    target: EffectTarget = {},
  ): boolean {
    const def = this.content.statuses.get(statusId);
    if (!def) return false;
    if (entity.hp <= 0) return false;
    if (def.kind === "debuff" && this.inSanctuary(entity)) return false;
    if (target.immunities?.some((tag) => def.tags.includes(tag))) return false;

    const existing = entity.statuses.find((s) => s.defId === statusId);
    if (existing) {
      if (def.stacking === "ignore") return false;
      if (def.stacking === "refresh") {
        existing.remaining = def.duration;
        return true;
      }
      // stack
      if (existing.stacks >= (def.maxStacks ?? 3)) return false;
      existing.stacks++;
      existing.remaining = def.duration;
      return true;
    }

    entity.statuses.push({
      defId: statusId,
      remaining: def.duration,
      tickAccum: 0,
      stacks: 1,
    });
    events.push({ t: "status", id: entity.id, status: statusId, on: true });
    if (def.onApply) this.runPrimitives(entity, def.onApply, events, target);
    this.runInteractionRules(entity, events);
    return true;
  }

  /** Remove active statuses carrying the given tag. */
  removeStatusesByTag(entity: Entity, tag: string, events: EffectEvent[]): void {
    for (let i = entity.statuses.length - 1; i >= 0; i--) {
      const status = entity.statuses[i]!;
      const def = this.content.statuses.get(status.defId);
      if (def && (def.tags.includes(tag) || def.appliesTags?.includes(tag))) {
        entity.statuses.splice(i, 1);
        events.push({ t: "status", id: entity.id, status: status.defId, on: false });
      }
    }
  }

  /** Advance all statuses on an entity by dt seconds. */
  tick(
    entity: Entity,
    dt: number,
    events: EffectEvent[],
    target: EffectTarget = {},
    rng: () => number = Math.random,
  ): void {
    for (let i = entity.statuses.length - 1; i >= 0; i--) {
      const status = entity.statuses[i]!;
      const def = this.content.statuses.get(status.defId);
      if (!def) {
        entity.statuses.splice(i, 1);
        continue;
      }
      if (def.onTick && def.tickEvery) {
        status.tickAccum += dt;
        while (status.tickAccum >= def.tickEvery) {
          status.tickAccum -= def.tickEvery;
          for (let s = 0; s < status.stacks; s++) {
            // A status's own tags describe the damage source: fire-
            // tagged ticks burn flammable targets harder (damageScale).
            this.runPrimitives(entity, def.onTick, events, target, rng, def.tags);
          }
          if (entity.hp <= 0) return; // died to a tick; stop processing
        }
      }
      if (status.remaining !== null) {
        status.remaining -= dt;
        if (status.remaining <= 0) {
          entity.statuses.splice(i, 1);
          events.push({ t: "status", id: entity.id, status: status.defId, on: false });
          if (def.onExpire) this.runPrimitives(entity, def.onExpire, events, target);
        }
      }
    }
  }

  /** Combined speed multiplier from whileActive modify_stat primitives. */
  speedMult(entity: Entity): number {
    let mult = 1;
    for (const status of entity.statuses) {
      const def = this.content.statuses.get(status.defId);
      if (!def?.whileActive) continue;
      for (const p of def.whileActive) {
        if (p.primitive === "modify_stat" && p.stat === "speed") mult *= p.mult;
      }
    }
    return mult;
  }

  /**
   * Tag interaction rules (fire + wet ⇒ extinguish…): evaluated to a
   * bounded fixpoint whenever tags may have changed.
   */
  runInteractionRules(entity: Entity, events: EffectEvent[]): void {
    for (let pass = 0; pass < 4; pass++) {
      const tags = this.tagsOf(entity);
      let changed = false;
      for (const rule of this.content.rules) {
        if (!tags.has(rule.when[0]) || !tags.has(rule.when[1])) continue;
        if (rule.removeTags) {
          for (const tag of rule.removeTags) this.removeStatusesByTag(entity, tag, events);
          changed = true;
        }
        if (rule.apply) changed = this.applyRuleStatus(entity, rule.apply, events) || changed;
      }
      if (!changed) return;
    }
  }

  private applyRuleStatus(entity: Entity, statusId: string, events: EffectEvent[]): boolean {
    // Avoid infinite loops: rules never re-apply a status already present.
    if (entity.statuses.some((s) => s.defId === statusId)) return false;
    return this.applyStatus(entity, statusId, events);
  }

  /**
   * Execute event-like primitives against an entity. spawn_area is
   * emitted as an event for the sim to realize (the engine has no
   * world-mutation authority of its own).
   */
  runPrimitives(
    entity: Entity,
    primitives: readonly Primitive[],
    events: EffectEvent[],
    target: EffectTarget = {},
    rng: () => number = Math.random,
    sourceTags?: readonly string[],
  ): void {
    for (const p of primitives) {
      switch (p.primitive) {
        case "modify_health":
          this.modifyHealth(
            entity,
            p.amount,
            events,
            sourceTags ? { sourceTags } : {},
            target,
          );
          break;
        case "apply_status":
          if (p.chance === undefined || rng() < p.chance) {
            this.applyStatus(entity, p.status, events, target);
          }
          break;
        case "remove_status":
          this.removeStatusesByTag(entity, p.tag, events);
          break;
        case "spawn_area":
          events.push({
            t: "spawnArea",
            x: Math.floor(entity.body.x),
            y: Math.floor(entity.body.y),
            area: p.area,
            radius: p.radius,
          });
          break;
        case "destroy_entity":
          events.push({ t: "destroy", id: entity.id });
          break;
        case "modify_stat":
          break; // continuous — read via speedMult(), not executed
      }
      if (entity.hp <= 0) return;
    }
  }
}
