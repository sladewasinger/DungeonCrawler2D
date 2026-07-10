import type { EnemyAnimationState } from "@dc2d/engine";

export const ENEMY_SPRITE_IDS = ["slime", "plant-creeper", "skeleton", "spitter"] as const;

export const ENEMY_FRAME_COUNT = 3;

export const SPITTER_FRAME_COUNTS: Record<EnemyAnimationState, number> = {
  idle: 3,
  walk: 4,
  windup: 2,
  spit: 1,
  recover: 2,
  attack: 1,
};

const ENEMY_SPRITE_SET = new Set<string>(ENEMY_SPRITE_IDS);

export function enemyFrameCount(defId: string, state: EnemyAnimationState): number {
  return defId === "spitter" ? SPITTER_FRAME_COUNTS[state] : ENEMY_FRAME_COUNT;
}

export function enemyTextureKey(defId: string, state: EnemyAnimationState, frame: number): string {
  const enemyId = ENEMY_SPRITE_SET.has(defId) ? defId : "slime";
  const frameCount = enemyFrameCount(enemyId, state);
  const animationFrame = ((frame % frameCount) + frameCount) % frameCount;
  return enemyId === "spitter"
    ? `enemy-spitter-${state}-${animationFrame}`
    : `enemy-${enemyId}-${animationFrame}`;
}
