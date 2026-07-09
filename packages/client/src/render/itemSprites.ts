export const ITEM_SPRITE_IDS = [
  "rag",
  "stick",
  "bandage",
  "knife",
  "sword",
  "hammer",
  "torch",
  "vodka-bottle",
  "water-flask",
  "raw-meat",
] as const;

const ITEM_SPRITE_SET = new Set<string>(ITEM_SPRITE_IDS);

export function itemTextureKey(defId: string): string {
  return `item-${ITEM_SPRITE_SET.has(defId) ? defId : "water-flask"}`;
}

export function itemAssetPath(defId: string): string {
  const itemId = ITEM_SPRITE_SET.has(defId) ? defId : "water-flask";
  return `assets/items/${itemId}.png`;
}
