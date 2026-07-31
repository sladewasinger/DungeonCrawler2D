// Enemy defs — combat stats, status application on hit, immunities, and drop tables.
import { z } from "zod";
import { COMBAT_HURTBOX_TUNING } from "../../combat/geometry/combatHurtboxTuning.js";

export const ENEMY_ELEMENTAL_ATTACKS = [
  "oil-lob",
  "directional-flame",
] as const;

const enemyBodyVisualSchema = z.object({
  sourceWidthPixels: z.number().int().positive(),
  sourceHeightPixels: z.number().int().positive(),
  renderedPaddingPixels: z.number().nonnegative(),
});

export const enemyDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.array(z.string()),
  hp: z.number().positive(),
  speed: z.number().nonnegative(),
  aggroRadius: z.number().positive(),
  /** Authored ground-plane combat box; legacy test fixtures use kind defaults. */
  hurtbox: z.object({
    halfWidth: z.number().positive(),
    halfDepth: z.number().positive(),
    height: z.number().positive(),
    bottomOffset: z.number().finite(),
  }).optional(),
  /** Source-art body bounds and rendered padding used to audit the hurtbox. */
  bodyVisual: enemyBodyVisualSchema.optional(),
  attack: z.object({
    damage: z.number().nonnegative(),
    range: z.number().positive(),
    cooldown: z.number().positive(),
    /** Ranged attacks lob a projectile instead of striking. */
    ranged: z.boolean().optional(),
    /** Server-owned elemental delivery layered onto the ranged attack phases. */
    elemental: z.enum(ENEMY_ELEMENTAL_ATTACKS).optional(),
    applies: z.array(z.object({ status: z.string(), chance: z.number().min(0).max(1) })).optional(),
  }),
  /** Status tags this enemy cannot receive (slime is immune to bleed). */
  immunities: z.array(z.string()).optional(),
  /** Damage multipliers by source tag (flammable plants burn ×2). */
  damageScale: z.record(z.string(), z.number().positive()).optional(),
  drops: z.array(z.object({ item: z.string(), chance: z.number().min(0).max(1) })),
  sprite: z.string(),
  /** Prevents AI movement and attacks while preserving damage/status simulation. */
  stationary: z.boolean().optional(),
  /** Recreate this enemy after a fixed delay when defeated in the sandbox. */
  respawnDelaySeconds: z.number().positive().optional(),
  /** Optional fixed-cadence weapon exercise used by combat training targets. */
  trainingWeapon: z.object({
    itemId: z.string(),
    attackIntervalSeconds: z.number().positive(),
  }).optional(),
  /** XP granted to the killer on death (Epic 11 core, pulled forward into
   * Epic 7.13 — ASSUMPTION #90, docs/ASSUMPTIONS.md). Optional so hand-built
   * EnemyDef fixtures elsewhere in the repo need no changes; an absent
   * value simply awards none. */
  xp: z.number().nonnegative().optional(),
  /**
   * One-line kill-feed epithet (Epic 7.13, book-fan lane — ASSUMPTION
   * #101, docs/ASSUMPTIONS.md), e.g. "dissolved by a slime. A slime."
   * Optional so hand-built EnemyDef fixtures elsewhere keep compiling
   * unchanged; the death announcer doesn't consume this yet (its own
   * generic pools cover Epic 7.13's death lines) — wiring a per-enemy
   * epithet into a specific kill needs the attacker-species plumbed
   * through to resolvePlayerDeath, out of this lane's owned files.
   */
  epithet: z.string().optional(),
}).superRefine(validateSpriteFittedHurtbox);
export type EnemyDef = z.infer<typeof enemyDefSchema>;

interface EnemyDefinitionInput {
  readonly bodyVisual?: z.infer<typeof enemyBodyVisualSchema> | undefined;
  readonly hurtbox?: {
    readonly halfWidth: number;
    readonly halfDepth: number;
    readonly height: number;
    readonly bottomOffset: number;
  } | undefined;
}

function validateSpriteFittedHurtbox(
  definition: EnemyDefinitionInput,
  context: z.RefinementCtx,
): void {
  const { bodyVisual, hurtbox } = definition;
  if (!bodyVisual || !hurtbox) return;
  const expected = expectedHurtbox(bodyVisual);
  validateMetric(context, { metric: "halfWidth", actual: hurtbox.halfWidth, expected: expected.halfWidth });
  validateMetric(context, { metric: "halfDepth", actual: hurtbox.halfDepth, expected: expected.halfDepth });
  validateMetric(context, { metric: "height", actual: hurtbox.height, expected: expected.height });
  validateMetric(context, { metric: "bottomOffset", actual: hurtbox.bottomOffset, expected: expected.bottomOffset });
}

function expectedHurtbox(body: z.infer<typeof enemyBodyVisualSchema>) {
  const tuning = COMBAT_HURTBOX_TUNING.presentation;
  const tilePixels = tuning.sourceTilePixels * tuning.renderScale;
  const padding = body.renderedPaddingPixels;
  return {
    halfWidth: (body.sourceWidthPixels * tuning.renderScale + padding * 2) / (tilePixels * 2),
    halfDepth: (body.sourceWidthPixels * tuning.renderScale + padding * 2) / (tilePixels * 2),
    height: (body.sourceHeightPixels * tuning.renderScale + padding * 2) / tilePixels,
    bottomOffset: padding / tilePixels,
  };
}

interface MetricValidation {
  readonly metric: "halfWidth" | "halfDepth" | "height" | "bottomOffset";
  readonly actual: number;
  readonly expected: number;
}

function validateMetric(context: z.RefinementCtx, validation: MetricValidation): void {
  if (Math.abs(validation.actual - validation.expected) <= 0.000001) return;
  context.addIssue({
    code: "custom",
    path: ["hurtbox", validation.metric],
    message: `${validation.metric} must match configured body pixels and rendered padding`,
  });
}
