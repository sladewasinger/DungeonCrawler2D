/**
 * Deterministic randomness. Everything here is integer-math based
 * (Math.imul + unsigned shifts) so results are byte-identical across
 * platforms and JS engines — a networking correctness requirement:
 * clients regenerate world chunks locally from seeds the server sends.
 */

/** Hash an arbitrary string to a uint32 seed (xmur3). */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Mix several uint32s into one (order-sensitive). */
export function mixSeeds(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h ^= (p | 0) + 0x9e3779b9 + ((h << 6) | 0) + (h >>> 2);
    h = Math.imul(h, 2654435761) >>> 0;
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** Stateless 2D coordinate hash → uint32. The lattice basis for noise. */
export function hash2D(seed: number, x: number, y: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.imul(x | 0, 374761393), 668265263);
  h ^= h >>> 15;
  h = Math.imul(h ^ Math.imul(y | 0, 2246822519), 3266489917);
  h ^= h >>> 13;
  h = Math.imul(h, 2654435761);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Stateless coordinate hash → float in [0, 1). */
export function hash2DFloat(seed: number, x: number, y: number): number {
  return hash2D(seed, x, y) / 4294967296;
}

/** Stateful PRNG (mulberry32) for sequential draws. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}
