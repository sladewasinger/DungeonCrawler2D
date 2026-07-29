// Enemy defs — combat stats, status application on hit, immunities, and drop tables.
import { z } from "zod";

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
});
export type EnemyDef = z.infer<typeof enemyDefSchema>;
