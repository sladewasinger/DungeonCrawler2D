export interface SpriteMetrics {
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly shadowWidth: number;
  readonly shadowHeight: number;
  readonly healthOffsetY: number;
  readonly labelOffsetY: number;
  readonly footprintRadius: number;
}

export const PLAYER_METRICS: SpriteMetrics = {
  width: 54,
  height: 54,
  originX: 0.5,
  originY: 0.9,
  shadowWidth: 28,
  shadowHeight: 12,
  healthOffsetY: 54,
  labelOffsetY: 58,
  footprintRadius: 0.25,
};

const ENEMY_METRICS: Record<string, SpriteMetrics> = {
  slime: {
    width: 40,
    height: 40,
    originX: 0.5,
    originY: 0.78,
    shadowWidth: 24,
    shadowHeight: 10,
    healthOffsetY: 39,
    labelOffsetY: 43,
    footprintRadius: 0.22,
  },
  "plant-creeper": {
    width: 44,
    height: 44,
    originX: 0.5,
    originY: 0.8,
    shadowWidth: 27,
    shadowHeight: 12,
    healthOffsetY: 44,
    labelOffsetY: 48,
    footprintRadius: 0.24,
  },
  skeleton: {
    width: 47,
    height: 47,
    originX: 0.5,
    originY: 0.82,
    shadowWidth: 27,
    shadowHeight: 12,
    healthOffsetY: 47,
    labelOffsetY: 51,
    footprintRadius: 0.24,
  },
  spitter: {
    width: 44,
    height: 44,
    originX: 0.5,
    originY: 0.8,
    shadowWidth: 26,
    shadowHeight: 11,
    healthOffsetY: 44,
    labelOffsetY: 48,
    footprintRadius: 0.23,
  },
};

export function enemyMetrics(defId: string | undefined): SpriteMetrics {
  return ENEMY_METRICS[defId ?? ""] ?? ENEMY_METRICS.slime!;
}

export const ITEM_METRICS: SpriteMetrics = {
  width: 42,
  height: 42,
  originX: 0.5,
  originY: 0.74,
  shadowWidth: 18,
  shadowHeight: 8,
  healthOffsetY: 34,
  labelOffsetY: 38,
  footprintRadius: 0.12,
};

export const PROJECTILE_METRICS: SpriteMetrics = {
  width: 28,
  height: 28,
  originX: 0.5,
  originY: 0.5,
  shadowWidth: 15,
  shadowHeight: 7,
  healthOffsetY: 28,
  labelOffsetY: 31,
  footprintRadius: 0.08,
};

