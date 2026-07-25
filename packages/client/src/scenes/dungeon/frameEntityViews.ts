import type {
  ItemEntityView,
  MonsterEntityView,
  PlayerEntityView,
  ProjectileEntityView,
} from "../../render/entities/index.js";

export interface FrameEntityViews {
  readonly players: PlayerEntityView[];
  readonly enemies: MonsterEntityView[];
  readonly items: ItemEntityView[];
  readonly projectiles: ProjectileEntityView[];
}

export function createFrameEntityViews(): FrameEntityViews {
  return {
    players: [],
    enemies: [],
    items: [],
    projectiles: [],
  };
}

/** Rewrites caller-owned frame storage without replacing its array identity. */
export function mapFrameInto<T, U>(
  source: readonly T[],
  out: U[],
  map: (value: T) => U,
): U[] {
  out.length = source.length;
  for (let index = 0; index < source.length; index++) {
    const value = source[index];
    if (value !== undefined) out[index] = map(value);
  }
  return out;
}
