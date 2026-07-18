import type { EnemyAnimationState } from "@dc2d/engine";
import { assetUrl } from "../assetUrl";

export const ENEMY_SPRITE_IDS = ["slime", "plant-creeper", "skeleton", "spitter"] as const;

export const ENEMY_ANIMATION_STATES = ["idle", "walk", "windup", "spit", "recover", "attack"] as const;

export const NORMAL_ENEMY_FRAME_COUNTS: Record<EnemyAnimationState, number> = {
  idle: 1,
  walk: 2,
  windup: 1,
  spit: 1,
  recover: 1,
  attack: 1,
};

export const SPITTER_FRAME_COUNTS: Record<EnemyAnimationState, number> = {
  idle: 3,
  walk: 4,
  windup: 2,
  spit: 1,
  recover: 2,
  attack: 1,
};

const ENEMY_SPRITE_SET = new Set<string>(ENEMY_SPRITE_IDS);
const NORMAL_ENEMY_ASSET_DIR: Record<Exclude<(typeof ENEMY_SPRITE_IDS)[number], "spitter">, string> = {
  slime: "slime-v2",
  "plant-creeper": "plant-creeper-v2",
  skeleton: "skeleton-v3",
};

export function enemyFrameCount(defId: string, state: EnemyAnimationState): number {
  return defId === "spitter" ? SPITTER_FRAME_COUNTS[state] : NORMAL_ENEMY_FRAME_COUNTS[state];
}

export function enemyTextureKey(defId: string, state: EnemyAnimationState, frame: number): string {
  const enemyId = ENEMY_SPRITE_SET.has(defId) ? defId : "slime";
  const frameCount = enemyFrameCount(enemyId, state);
  const animationFrame = ((frame % frameCount) + frameCount) % frameCount;
  return enemyId === "spitter"
    ? `enemy-spitter-${state}-${animationFrame}`
    : `enemy-${enemyId}-${state}-${animationFrame}`;
}

export function enemyAssetPath(defId: string, state: EnemyAnimationState, frame: number): string {
  const enemyId = ENEMY_SPRITE_SET.has(defId) ? (defId as (typeof ENEMY_SPRITE_IDS)[number]) : "slime";
  const frameCount = enemyFrameCount(enemyId, state);
  const animationFrame = ((frame % frameCount) + frameCount) % frameCount;
  const directory = enemyId === "spitter" ? "spitter-v3" : NORMAL_ENEMY_ASSET_DIR[enemyId];
  return assetUrl(`assets/enemies/${directory}/${state}-${animationFrame}.png`);
}
