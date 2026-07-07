import { z } from "zod";

/**
 * Content schemas — the contract shared by hand-authored JSON files,
 * unit tests, and (v0.6) the AI crafting pipeline's structured output.
 * One validator, every consumer. The engine implements PRIMITIVES;
 * content (and later the AI) may only compose them. Content never
 * contains code.
 */

// ── effect primitives ──────────────────────────────────────────────

export const primitiveSchema = z.discriminatedUnion("primitive", [
  z.object({
    primitive: z.literal("modify_health"),
    /** Positive heals, negative damages. Applied once per firing. */
    amount: z.number(),
  }),
  z.object({
    primitive: z.literal("modify_stat"),
    stat: z.enum(["speed"]),
    /** Multiplier while the owning status is active. */
    mult: z.number().positive().max(5),
  }),
  z.object({
    primitive: z.literal("apply_status"),
    status: z.string(),
    chance: z.number().min(0).max(1).optional(),
  }),
  z.object({
    primitive: z.literal("remove_status"),
    /** Removes active statuses carrying this tag. */
    tag: z.string(),
  }),
  z.object({
    primitive: z.literal("spawn_area"),
    area: z.string(),
    radius: z.number().int().min(0).max(4),
  }),
  z.object({ primitive: z.literal("destroy_entity") }),
]);
export type Primitive = z.infer<typeof primitiveSchema>;

// ── statuses ───────────────────────────────────────────────────────

export const statusDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["buff", "debuff"]),
  tags: z.array(z.string()),
  /** Seconds; null = until removed. */
  duration: z.number().positive().nullable(),
  /** Seconds between onTick firings (requires onTick). */
  tickEvery: z.number().positive().optional(),
  stacking: z.enum(["refresh", "stack", "ignore"]),
  maxStacks: z.number().int().min(1).max(10).optional(),
  /** Tags the bearer gains while this status is active. */
  appliesTags: z.array(z.string()).optional(),
  onApply: z.array(primitiveSchema).optional(),
  onTick: z.array(primitiveSchema).optional(),
  onExpire: z.array(primitiveSchema).optional(),
  /** Continuous modifiers evaluated while active (modify_stat only). */
  whileActive: z.array(primitiveSchema).optional(),
});
export type StatusDef = z.infer<typeof statusDefSchema>;

// ── tag interaction rules ──────────────────────────────────────────

export const interactionRuleSchema = z.object({
  /** Fires when an entity carries both tags at once. */
  when: z.tuple([z.string(), z.string()]),
  /** Strip active statuses carrying any of these tags. */
  removeTags: z.array(z.string()).optional(),
  /** Apply this status. */
  apply: z.string().optional(),
});
export type InteractionRule = z.infer<typeof interactionRuleSchema>;

// ── area effects ───────────────────────────────────────────────────

export const areaDefSchema = z.object({
  id: z.string(),
  tags: z.array(z.string()),
  /** -1 sinks/flows downhill, 0 stays, +1 rises/drifts uphill. */
  buoyancy: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  /** Seconds a tile of this area lives. */
  duration: z.number().positive(),
  /** Status applied to grounded entities standing in it. */
  onEnterStatus: z.string().optional(),
  /** Spread to adjacent tiles: chance per tick per tile. */
  spread: z
    .object({
      chance: z.number().min(0).max(1),
      /** Only spread onto tiles carrying an area with this tag (fuel). */
      ontoAreaTag: z.string().optional(),
      /** Max generations of spread from the origin. */
      maxSteps: z.number().int().min(0).max(20),
    })
    .optional(),
  /** Atlas frame key for rendering. */
  sprite: z.string(),
});
export type AreaDef = z.infer<typeof areaDefSchema>;

// ── items ──────────────────────────────────────────────────────────

export const itemDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  maxStack: z.number().int().min(1).max(99),
  consumable: z
    .object({
      /** Applied to the consumer. */
      effects: z.array(primitiveSchema),
    })
    .optional(),
  throwable: z
    .object({
      /** Applied at the impact tile / direct-hit entity. */
      onImpact: z.array(primitiveSchema),
      /** Chance the item is destroyed on impact (else drops). */
      breakChance: z.number().min(0).max(1),
    })
    .optional(),
  weapon: z
    .object({
      damage: z.number().positive(),
      /** Statuses applied to melee victims. */
      applies: z.array(z.object({ status: z.string(), chance: z.number().min(0).max(1) })).optional(),
    })
    .optional(),
});
export type ItemDef = z.infer<typeof itemDefSchema>;

// ── enemies ────────────────────────────────────────────────────────

export const enemyDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  hp: z.number().positive(),
  speed: z.number().positive(),
  aggroRadius: z.number().positive(),
  attack: z.object({
    damage: z.number().positive(),
    range: z.number().positive(),
    cooldown: z.number().positive(),
    /** Ranged attacks lob a projectile instead of striking. */
    ranged: z.boolean().optional(),
    applies: z.array(z.object({ status: z.string(), chance: z.number().min(0).max(1) })).optional(),
  }),
  /** Status tags this enemy cannot receive (slime is immune to bleed). */
  immunities: z.array(z.string()).optional(),
  /** Damage multipliers by source tag (flammable plants burn ×2). */
  damageScale: z.record(z.string(), z.number().positive()).optional(),
  drops: z.array(z.object({ item: z.string(), chance: z.number().min(0).max(1) })),
  sprite: z.string(),
});
export type EnemyDef = z.infer<typeof enemyDefSchema>;

// ── recipes ────────────────────────────────────────────────────────

export const recipeDefSchema = z.object({
  id: z.string(),
  inputs: z.array(z.object({ item: z.string(), qty: z.number().int().min(1) })),
  output: z.object({ item: z.string(), qty: z.number().int().min(1) }),
});
export type RecipeDef = z.infer<typeof recipeDefSchema>;

// ── registry ───────────────────────────────────────────────────────

export interface ContentRegistry {
  statuses: ReadonlyMap<string, StatusDef>;
  rules: readonly InteractionRule[];
  areas: ReadonlyMap<string, AreaDef>;
  items: ReadonlyMap<string, ItemDef>;
  enemies: ReadonlyMap<string, EnemyDef>;
  recipes: ReadonlyMap<string, RecipeDef>;
}

/**
 * Validate raw JSON content into a registry, cross-checking that every
 * referenced id exists — a nonsense reference is a content bug (or a
 * rejected AI proposal), never a runtime surprise.
 */
export function buildContentRegistry(raw: {
  statuses: unknown[];
  rules: unknown[];
  areas: unknown[];
  items: unknown[];
  enemies: unknown[];
  recipes: unknown[];
}): ContentRegistry {
  const statuses = new Map<string, StatusDef>();
  for (const s of raw.statuses) {
    const def = statusDefSchema.parse(s);
    if (statuses.has(def.id)) throw new Error(`duplicate status ${def.id}`);
    statuses.set(def.id, def);
  }
  const rules = raw.rules.map((r) => interactionRuleSchema.parse(r));
  const areas = new Map<string, AreaDef>();
  for (const a of raw.areas) {
    const def = areaDefSchema.parse(a);
    areas.set(def.id, def);
  }
  const items = new Map<string, ItemDef>();
  for (const i of raw.items) {
    const def = itemDefSchema.parse(i);
    items.set(def.id, def);
  }
  const enemies = new Map<string, EnemyDef>();
  for (const e of raw.enemies) {
    const def = enemyDefSchema.parse(e);
    enemies.set(def.id, def);
  }
  const recipes = new Map<string, RecipeDef>();
  for (const r of raw.recipes) {
    const def = recipeDefSchema.parse(r);
    recipes.set(def.id, def);
  }

  const checkStatus = (id: string, from: string) => {
    if (!statuses.has(id)) throw new Error(`${from} references unknown status "${id}"`);
  };
  const checkPrimitives = (prims: readonly Primitive[] | undefined, from: string) => {
    if (!prims) return;
    for (const p of prims) {
      if (p.primitive === "apply_status") checkStatus(p.status, from);
      if (p.primitive === "spawn_area" && !areas.has(p.area))
        throw new Error(`${from} references unknown area "${p.area}"`);
    }
  };
  for (const s of statuses.values()) {
    checkPrimitives(s.onApply, `status ${s.id}`);
    checkPrimitives(s.onTick, `status ${s.id}`);
    checkPrimitives(s.onExpire, `status ${s.id}`);
  }
  for (const r of rules) if (r.apply) checkStatus(r.apply, `rule ${r.when.join("+")}`);
  for (const a of areas.values())
    if (a.onEnterStatus) checkStatus(a.onEnterStatus, `area ${a.id}`);
  for (const i of items.values()) {
    checkPrimitives(i.consumable?.effects, `item ${i.id}`);
    checkPrimitives(i.throwable?.onImpact, `item ${i.id}`);
    for (const w of i.weapon?.applies ?? []) checkStatus(w.status, `item ${i.id}`);
  }
  for (const e of enemies.values()) {
    for (const a of e.attack.applies ?? []) checkStatus(a.status, `enemy ${e.id}`);
    for (const d of e.drops)
      if (!items.has(d.item)) throw new Error(`enemy ${e.id} drops unknown item "${d.item}"`);
  }
  for (const r of recipes.values()) {
    for (const input of r.inputs)
      if (!items.has(input.item)) throw new Error(`recipe ${r.id} uses unknown item`);
    if (!items.has(r.output.item)) throw new Error(`recipe ${r.id} outputs unknown item`);
  }

  return { statuses, rules, areas, items, enemies, recipes };
}
