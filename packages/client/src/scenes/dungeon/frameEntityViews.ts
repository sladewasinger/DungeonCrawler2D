import type {
  ItemEntityView,
  MonsterEntityView,
  PetEntityView,
  PlayerEntityView,
  ProjectileEntityView,
} from "../../render/entities/index.js";

export interface FrameEntityViews {
  readonly players: PlayerEntityView[];
  readonly playerRecords: PlayerEntityView[];
  readonly enemies: MonsterEntityView[];
  readonly enemyRecords: MonsterEntityView[];
  readonly pets: PetEntityView[];
  readonly petRecords: PetEntityView[];
  readonly items: ItemEntityView[];
  readonly itemRecords: ItemEntityView[];
  readonly projectiles: ProjectileEntityView[];
  readonly projectileRecords: ProjectileEntityView[];
}

export function createFrameEntityViews(): FrameEntityViews {
  return {
    players: [],
    playerRecords: [],
    enemies: [],
    enemyRecords: [],
    pets: [],
    petRecords: [],
    items: [],
    itemRecords: [],
    projectiles: [],
    projectileRecords: [],
  };
}

/** Rewrites caller-owned frame storage without replacing its array identity. */
export function mapFrameInto<T, U>(
  source: readonly T[],
  out: U[],
  records: U[],
  map: (value: T, target: U | undefined) => U,
): U[] {
  out.length = source.length;
  for (let index = 0; index < source.length; index++) {
    const value = source[index];
    if (value === undefined) continue;
    const record = map(value, records[index]);
    records[index] = record;
    out[index] = record;
  }
  return out;
}
