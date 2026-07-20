import { TICK_RATE } from "@dc2d/engine";

/** Tuned constants for Epic 7.14 (The Descent) — one place for every
 * multi-floor/boss magic number, per ENGINEERING_STANDARDS's "data-driven
 * or it doesn't ship" + "one place" rules. */

/** Deepest floor this wave generates; floor 5 holds the boss arena
 * instead of a StairwayDown. */
export const FLOOR_CAP = 5;

/** Compounding per-floor enemy stat multiplier (hp/damage/xp only —
 * enemy VISUAL scale is untouchable, ROADMAP.md's hard rule). Floor 1
 * multiplier is exactly 1.0 (1.35^0), so floor 1 behavior is unchanged. */
export const FLOOR_STAT_GROWTH = 1.35;

/** Content id of the floor-5 boss (docs/content/enemies.json). */
export const WARDEN_DEF_ID = "warden-of-five";

/** Flat XP awarded to every player standing inside the arena at the
 * moment the Warden dies — independent of (and additional to) the
 * standard last-hit awardKillXp path (xp.ts), which also fires since the
 * Warden's content def carries its own `xp`; the last-hitter simply
 * collects both (ASSUMPTION #129, docs/ASSUMPTIONS.md). */
export const BOSS_XP_BURST = 1000;

/** Ticks between the Warden's death and its respawn at the arena anchor. */
export const BOSS_RESPAWN_TICKS = 5 * 60 * TICK_RATE;
