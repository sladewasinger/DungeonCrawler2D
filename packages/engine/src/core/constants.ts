// Tuned gameplay/physics/network constants shared by server and client — values are
// ported byte-for-byte from reference/engine/core/constants.ts; changing any of them
// changes movement feel or netcode behavior and must be a deliberate, reviewed change.

export const PROTOCOL_VERSION = 10;
export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;

export const MOVE_SPEED = 8;
export const STEP_UP = 1;
// Ascent launch speed and ascent-phase gravity. Tuned as a pair against
// the feel harness (packages/engine/src/entities/feel-harness.ts) to hit
// a 0.26-0.34s time-to-apex and a 2.5-2.8 tile full-hop apex at the fixed
// 20Hz tick — see feel.test.ts for the asserted bands.
export const JUMP_VELOCITY = 17.03;
export const GRAVITY = 67.8;
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
export const AIRBORNE_LEDGE_CLEARANCE = 0.18;
export const LANDING_TOLERANCE = 0.08;
export const WALL_RISE = 2;

export const AOI_RADIUS = 40;
export const MIN_SPAWN_DIST = 80;
export const SPAWN_CHUNK_RANGE = 16;
export const RECONNECT_GRACE_MS = 30_000;
export const MAX_INPUTS_PER_TICK = 5;
export const SAFE_FALL_HEIGHT = 3;
export const FALL_DAMAGE_PER_UNIT = 6;

export const MELEE_RANGE = 1.6;
export const ATTACK_COOLDOWN_MS = 350;
export const MELEE_ARC_COS = 0.35;
export const FIST_DAMAGE = 3;
export const KNOCKBACK_FORCE = 10;
export const KNOCKBACK_DECAY = 0.72;
export const PLAYER_MAX_HP = 30;
export const RESPAWN_DELAY_TICKS = 40;
export const DOWNED_DURATION = 30;
export const REVIVE_HP_FRACTION = 0.3;

export const THROW_SPEED = 10;
export const MAX_THROW_RANGE = 8;
export const PICKUP_RANGE = 1.5;
export const INTERACT_RANGE = 1.6;
export const HOTBAR_SLOTS = 9;
export const ENEMY_ACTIVE_RADIUS = 48;
