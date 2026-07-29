import type {
  ItemEntityView,
  MonsterEntityView,
  PetEntityView,
  PlayerEntityView,
  ProjectileEntityView,
} from "../../../render/entities/geometry/index.js";

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
export interface FrameMap<T, U> {
  readonly source: readonly T[];
  readonly out: U[];
  readonly records: U[];
  readonly map: (value: T, target: U | undefined) => U;
}

export function mapFrameInto<T, U>(input: FrameMap<T, U>): U[] {
  const { source, out, records, map } = input;
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
