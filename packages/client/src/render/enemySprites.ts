export const ENEMY_SPRITE_IDS = ["slime", "plant-creeper", "skeleton", "spitter"] as const;

export const ENEMY_FRAME_COUNT = 3;

const ENEMY_SPRITE_SET = new Set<string>(ENEMY_SPRITE_IDS);

export function enemyTextureKey(defId: string, frame: number): string {
  const enemyId = ENEMY_SPRITE_SET.has(defId) ? defId : "slime";
  const animationFrame = ((frame % ENEMY_FRAME_COUNT) + ENEMY_FRAME_COUNT) % ENEMY_FRAME_COUNT;
  return `enemy-${enemyId}-${animationFrame}`;
}
