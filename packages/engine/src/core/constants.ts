// Tuned gameplay/physics/network constants shared by server and client — values are
// ported byte-for-byte from reference/engine/core/constants.ts; changing any of them
// changes movement feel or netcode behavior and must be a deliberate, reviewed change.
//
// Z-SCALE DOCTRINE: 1 z-unit = 1 tile edge. Every z-denominated constant below
// (wall/stair/fall heights, clearances) is authored on that footing — a wall is
// exactly one tile-edge tall (z1): it blocks walking and is a clean single jump.
// Movement FEEL is independent of this and must never drift with it: JUMP_VELOCITY
// and GRAVITY (ascent) are scaled TOGETHER by the same factor, which holds
// time-to-apex (v/g) constant while apex height (v²/2g) scales with them — the hop
// still takes the same beats, it just travels half as many world-units high because
// those units are now worth twice as much.

export const PROTOCOL_VERSION = 15;
export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;

export const MOVE_SPEED = 8;
// Epic 7.12 run input: v1's SHIFT key was never a run modifier (it stored a bound
// hotbar stack into the stash — reference/client/input/controller.ts) so there is
// nothing to port here; the multiplier is a fresh tuning call against the roadmap's
// own "likely ~1.5x" hint (docs/ASSUMPTIONS.md #65).
export const RUN_SPEED_MULTIPLIER = 1.5;
// A ≥1 rise (one tile edge) blocks walking outright — no more free
// full-tile walk-up steps. Still admits stair-ramp walking (the steepest
// authored ramp's per-step look-ahead rise is ~0.21 under BODY_RADIUS)
// and small lips/rubble.
export const STEP_UP = 0.35;
// Ascent launch speed and ascent-phase gravity. Tuned as a pair against
// the feel harness (packages/engine/src/entities/feel-harness.ts) to hit
// a 0.26-0.34s time-to-apex and a 1.25-1.4 tile full-hop apex at the fixed
// 20Hz tick — see feel.test.ts for the asserted bands. Halved together from
// the pre-rescale 17.03/67.8 pair: time-to-apex (v/g) is unchanged, apex
// height (v²/2g) halves with the z-scale doctrine above.
export const JUMP_VELOCITY = 8.515;
export const GRAVITY = 33.9;
// Descent falls under GRAVITY * this multiplier — snappier landing than
// ascent, the "come down faster than you went up" modern-platformer feel.
export const GRAVITY_DESCENT_MULT = 2.0;
// While |zVel| is below this fraction of JUMP_VELOCITY (near the top of
// the arc), gravity is scaled by APEX_HANG_GRAVITY_MULT for a brief hang.
export const APEX_HANG_SPEED_FRACTION = 0.12;
export const APEX_HANG_GRAVITY_MULT = 0.7;
// Releasing jump while rising zeroes the remaining ascent (Mario-style
// hard cut) — but only once zVel has decayed below
// JUMP_CUT_GRACE_FRACTION * JUMP_VELOCITY. The grace window means a
// single-tick tap (press then release next tick, as a jump-buffered
// climb input does) still commits to a full hop instead of stalling
// underneath the ledge it was meant to clear; only a deliberately held
// then released jump produces a short hop.
export const JUMP_CUT_MULTIPLIER = 0;
export const JUMP_CUT_GRACE_FRACTION = 0.7;
// Downward speed cap (~2x launch speed) so falls stay controllable.
export const TERMINAL_FALL_VELOCITY = 2 * JUMP_VELOCITY;
export const COYOTE_TIME = 0.15;
export const JUMP_BUFFER_TIME = 0.15;
export const AIRBORNE_LEDGE_CLEARANCE = 0.09;
export const LANDING_TOLERANCE = 0.04;
export const WALL_RISE = 1;
/**
 * RENDERING threshold, not collision: the minimum height drop a south
 * tile edge needs before the client draws face rows there (the visible
 * wall face lives on the raised tile itself — see the client's terrain
 * renderer). Collision is pure height, gated by STEP_UP above.
 */
export const WALL_FACE_MIN_DROP = 0.75;

export const AOI_RADIUS = 40;
export const MIN_SPAWN_DIST = 80;
export const SPAWN_CHUNK_RANGE = 16;
export const RECONNECT_GRACE_MS = 30_000;
export const MAX_INPUTS_PER_TICK = 5;
export const SAFE_FALL_HEIGHT = 1.5;
// Doubled alongside SAFE_FALL_HEIGHT's halving so damage for an
// EQUIVALENT real-world drop (in tile-edges) is unchanged.
export const FALL_DAMAGE_PER_UNIT = 12;
// Design ruling (2026-07-19): rifts are knockback death-pits, not
// inescapable holes. A grounded body at or below this z is standing in a
// chasm (CHASM_DEPTH -2 in world/generate/height.ts, with slack above the
// true floor so the ruling fires before a body settles all the way in) —
// game-server's sim kills it outright: full loot drop + respawn, the same
// path a normal death takes. Server-side only; the client never asserts
// this outcome, only predicts movement.
export const CHASM_DEATH_Z = -1.5;

export const MELEE_RANGE = 1.6;
export const ATTACK_COOLDOWN_MS = 350;
/** cos of the melee half-angle: 0.7071 = 45° half = 90° total arc
 * (user playtest 2026-07-20: the old ~140° arc read as a lazy 180°). */
export const MELEE_ARC_COS = 0.7071;
export const FIST_DAMAGE = 3;
export const KNOCKBACK_FORCE = 10;
export const KNOCKBACK_DECAY = 0.72;
export const PLAYER_MAX_HP = 30;
export const RESPAWN_DELAY_TICKS = 40;
export const DOWNED_DURATION = 60;
export const REVIVE_HP_FRACTION = 0.3;
export const PARTY_FRIENDLY_FIRE_SCALE = 0.5;

export const THROW_SPEED = 10;
export const MAX_THROW_RANGE = 8;
export const PICKUP_RANGE = 1.5;
export const INTERACT_RANGE = 1.6;
export const HOTBAR_SLOTS = 9;
export const ENEMY_ACTIVE_RADIUS = 48;

// ASSUMPTION #40 (docs/ASSUMPTIONS.md): a placed torch burns for 180s of
// server ticks at the fixed TICK_RATE, then despawns.
export const TORCH_BURN_TICKS = 180 * TICK_RATE;

// ASSUMPTION #90 (docs/ASSUMPTIONS.md): Epic 11 core (character levels),
// pulled forward into Epic 7.13 by the user's second playtest. Total XP to
// REACH `level` (level 1 = 0 XP) grows quadratically with no cap: each
// step to the next level costs 2*XP_LEVEL_CURVE_COEFFICIENT more XP than
// the previous step did, so the climb steepens smoothly instead of
// jumping. `xpForLevel(2) = 100`, `xpForLevel(3) = 300`, `xpForLevel(4) =
// 600`, etc.
export const XP_LEVEL_CURVE_COEFFICIENT = 50;
export function xpForLevel(level: number): number {
  return XP_LEVEL_CURVE_COEFFICIENT * (level - 1) * level;
}
