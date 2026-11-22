/** Deterministic integer hashing and smooth 2D procedural noise primitives. */

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Deterministic uint32 hash of world seed and integer coordinates. */
export function hash2d(seed: number, x: number, y: number): number {
  let h = (Math.imul(seed | 0, 374761393) + Math.imul(x | 0, 668265263)) | 0;
  h = (h + Math.imul(y | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function hashUnit2d(seed: number, x: number, y: number): number {
  return hash2d(seed, x, y) / 4294967296;
}

export function valueNoise2d(input: {
  readonly seed: number;
  readonly x: number;
  readonly y: number;
}): number {
  const ix = Math.floor(input.x);
  const iy = Math.floor(input.y);
  const fx = input.x - ix;
  const fy = input.y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hashUnit2d(input.seed, ix, iy);
  const b = hashUnit2d(input.seed, ix + 1, iy);
  const c = hashUnit2d(input.seed, ix, iy + 1);
  const d = hashUnit2d(input.seed, ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

export interface FbmOptions {
  readonly seed: number;
  readonly x: number;
  readonly y: number;
  readonly octaves?: number;
}

export function fbm2d(options: FbmOptions): number {
  const octaves = options.octaves ?? 4;
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const sample = valueNoise2d({
      seed: options.seed + i * 97,
      x: options.x * frequency,
      y: options.y * frequency,
    });
    sum += sample * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return norm > 0 ? sum / norm : 0;
}

export function ridgeNoise2d(options: FbmOptions): number {
  const base = fbm2d(options);
  return 1 - Math.abs(base * 2 - 1);
}
