// 2D value noise built on rng.ts's coordinate hash — the engine's terrain-shaping
// primitive, pure functions of (seed, x, y) so chunk borders match without stitching.
import { hash2DFloat } from "./rng.js";

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 2D value noise in [0, 1]: hash lattice corners, bilinear-blend with
 * smoothstep. Pure function of (seed, x, y) — chunk borders match for
 * free because neighbors sample the same lattice.
 */
export function valueNoise2D(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const v00 = hash2DFloat(seed, x0, y0);
  const v10 = hash2DFloat(seed, x0 + 1, y0);
  const v01 = hash2DFloat(seed, x0, y0 + 1);
  const v11 = hash2DFloat(seed, x0 + 1, y0 + 1);
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
}

/** Fractal (octaved) value noise, normalized back to [0, 1]. */
export function fbm2D(
  seed: number,
  x: number,
  y: number,
  octaves: number,
  lacunarity = 2,
  gain = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    // Offset the seed per octave so octaves are uncorrelated.
    sum += amp * valueNoise2D((seed + i * 0x51ab_7f0d) >>> 0, x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
