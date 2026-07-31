import { petAssetFor } from "../../boot/petAssetManifest.js";

export interface AdminCatalogImage {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AdminPetCatalogImage {
  readonly source: "pet";
  readonly defId: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

export type AdminCatalogVisual = AdminCatalogImage | AdminPetCatalogImage;

export function enemyCatalogImage(sprite: string | undefined): AdminCatalogImage | null {
  return sprite ? ENEMY_IMAGES[sprite] ?? null : null;
}

export function itemCatalogImage(id: string): AdminCatalogImage | null {
  return ITEM_IMAGES[id] ?? null;
}

export function petCatalogImage(id: string): AdminPetCatalogImage | null {
  const asset = petAssetFor(id);
  if (!asset) return null;
  return {
    source: "pet",
    defId: id,
    path: asset.path,
    width: asset.frameWidth,
    height: asset.frameHeight,
  };
}

const ENEMY_IMAGES: Readonly<Record<string, AdminCatalogImage>> = {
  slime: { x: 85, y: 578, width: 16, height: 16 },
  plant_creeper: { x: 65, y: 513, width: 24, height: 24 },
  pitchbloom: { x: 265, y: 513, width: 24, height: 24 },
  skelet: { x: 368, y: 88, width: 16, height: 16 },
  imp: { x: 368, y: 64, width: 16, height: 16 },
  goblin: { x: 368, y: 40, width: 16, height: 16 },
  masked_orc: { x: 368, y: 153, width: 16, height: 23 },
  orc_warrior: { x: 368, y: 177, width: 16, height: 23 },
  orc_shaman: { x: 368, y: 201, width: 16, height: 23 },
  ogre: { x: 16, y: 380, width: 32, height: 36 },
  tiny_zombie: { x: 368, y: 16, width: 16, height: 16 },
  big_zombie: { x: 16, y: 332, width: 32, height: 36 },
  chort: { x: 368, y: 273, width: 16, height: 23 },
  big_demon: { x: 16, y: 428, width: 32, height: 36 },
  wogol: { x: 368, y: 249, width: 16, height: 23 },
  pumpkin_dude: { x: 368, y: 321, width: 16, height: 23 },
  angel: { x: 368, y: 304, width: 16, height: 16 },
};

const ITEM_IMAGES: Readonly<Record<string, AdminCatalogImage>> = {
  knife: { x: 293, y: 10, width: 6, height: 13 },
  sword: { x: 307, y: 10, width: 10, height: 21 },
  hammer: { x: 307, y: 39, width: 10, height: 24 },
  "water-flask": { x: 304, y: 352, width: 16, height: 16 },
  "vodka-bottle": { x: 288, y: 352, width: 16, height: 16 },
  bandage: { x: 0, y: 578, width: 16, height: 16 },
  rag: { x: 465, y: 513, width: 16, height: 16 },
  "raw-meat": { x: 17, y: 578, width: 16, height: 16 },
  stick: { x: 482, y: 513, width: 16, height: 16 },
  torch: { x: 34, y: 578, width: 16, height: 16 },
};
