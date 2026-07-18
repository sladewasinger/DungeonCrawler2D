// Deterministic integer hashing — the engine's only source of "randomness".
// No Math.random, no Date.now: every call is pure and reproducible cross-platform.

const toUint32 = (value: number): number => value >>> 0;

/**
 * Mixes a seed and an input into a deterministic 32-bit unsigned integer.
 * Same (seed, input) always produces the same output, on every platform —
 * later chunk/entity generation hashes build on this primitive.
 */
export function seededHash(seed: number, input: number): number {
  let mixed = toUint32(seed) ^ toUint32(input);
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b);
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b);
  mixed ^= mixed >>> 16;
  return toUint32(mixed);
}

/** Maps a seededHash output to a float in [0, 1), for probability rolls against content data. */
export function seededFloat(seed: number, input: number): number {
  return seededHash(seed, input) / 0x100000000;
}
