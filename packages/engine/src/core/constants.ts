/** Shared constants — the single source of truth for client and server. */

export const PROTOCOL_VERSION = 1;

/** Server simulation rate. Clients also step prediction at this rate. */
export const TICK_RATE = 20;
export const TICK_DT = 1 / TICK_RATE;

/** Movement (units: tiles, seconds). */
export const MOVE_SPEED = 8;
/** Max height an entity can walk up without jumping. */
export const STEP_UP = 1.0;
export const JUMP_VELOCITY = 11.5; // apex ≈ 2.2 tiles — clears one cliff step
export const GRAVITY = 30;

/** Area-of-interest replication radius (tiles). */
export const AOI_RADIUS = 40;

/** Spawning. */
export const MIN_SPAWN_DIST = 80; // tiles — distance is the protection; no spawn shield
export const SPAWN_CHUNK_RANGE = 16; // sample spawns within ±N chunks of origin

/** Disconnected players linger this long before their entity is reaped. */
export const RECONNECT_GRACE_MS = 30_000;

/** Cap on how many buffered inputs the server applies per player per tick. */
export const MAX_INPUTS_PER_TICK = 5;
