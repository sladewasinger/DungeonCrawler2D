/** Shared constants — the single source of truth for client and server. */

export const PROTOCOL_VERSION = 4;

/** Server simulation rate. Clients also step prediction at this rate. */
export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;

/** Movement (units: tiles, seconds). */
export const MOVE_SPEED = 8;
/** Max height an entity can walk up without jumping. */
export const STEP_UP = 1.0;
export const JUMP_VELOCITY = 11.5; // apex ≈ 2.2 tiles — clears one cliff step
export const GRAVITY = 30;
/**
 * Walls are terrain, not axioms: a wall tile is the local ground raised
 * this much — too tall to walk up, low enough to jump onto. Wall tops
 * are walkable platforms; falling off is just falling.
 */
export const WALL_RISE = 2;

/** Area-of-interest replication radius (tiles). */
export const AOI_RADIUS = 40;

/** Spawning. */
export const MIN_SPAWN_DIST = 80; // tiles — distance is the protection; no spawn shield
export const SPAWN_CHUNK_RANGE = 16; // sample spawns within ±N chunks of origin

/** Disconnected players linger this long before their entity is reaped. */
export const RECONNECT_GRACE_MS = 30_000;

/** Cap on how many buffered inputs the server applies per player per tick. */
export const MAX_INPUTS_PER_TICK = 5;

/** Verticality: falls beyond this height hurt (feather-fall negates). */
export const SAFE_FALL_HEIGHT = 3;
export const FALL_DAMAGE_PER_UNIT = 6;

/** Combat. */
export const MELEE_RANGE = 1.6;
/** Minimum time between melee swings — spam-clicking must not be the meta. */
export const ATTACK_COOLDOWN_MS = 350;
/** cos of the half-angle of the melee arc (~70°). */
export const MELEE_ARC_COS = 0.35;
export const FIST_DAMAGE = 3;
export const KNOCKBACK_FORCE = 10;
export const KNOCKBACK_DECAY = 0.72;
export const PLAYER_MAX_HP = 30;
export const RESPAWN_DELAY_TICKS = 40; // 2 s
export const DOWNED_DURATION = 30; // s — party bleed-out window
export const REVIVE_HP_FRACTION = 0.3;

/** Items. */
export const THROW_SPEED = 10; // tiles/s
export const MAX_THROW_RANGE = 8;
export const PICKUP_RANGE = 1.5;
export const INTERACT_RANGE = 1.6;
/** Quick-use bar size. The inventory itself is unlimited. */
export const HOTBAR_SLOTS = 9;

/** Enemies simulate only within this radius of any player. */
export const ENEMY_ACTIVE_RADIUS = 48;
