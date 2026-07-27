/** Pet sprites stay in their native sheets instead of being forced into the
 * 16px world atlas. Keeping the frame geometry here makes adding a future pet
 * a data-only change for the loader and renderer. */
export interface PetAssetSpec {
  readonly textureKey: string;
  readonly path: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly idleFrames: readonly number[];
  readonly walkFrames: readonly number[];
}

export const PET_ASSETS = {
  "pet-dino-doux": {
    textureKey: "pet-dino-doux",
    path: "assets/pets/dino-doux.png",
    frameWidth: 24,
    frameHeight: 24,
    idleFrames: [0, 1, 2, 3],
    walkFrames: [4, 5, 6, 7, 8, 9],
  },
  "pet-dino-mort": {
    textureKey: "pet-dino-mort",
    path: "assets/pets/dino-mort.png",
    frameWidth: 24,
    frameHeight: 24,
    idleFrames: [0, 1, 2, 3],
    walkFrames: [4, 5, 6, 7, 8, 9],
  },
  "pet-dino-tard": {
    textureKey: "pet-dino-tard",
    path: "assets/pets/dino-tard.png",
    frameWidth: 24,
    frameHeight: 24,
    idleFrames: [0, 1, 2, 3],
    walkFrames: [4, 5, 6, 7, 8, 9],
  },
  "pet-dino-vita": {
    textureKey: "pet-dino-vita",
    path: "assets/pets/dino-vita.png",
    frameWidth: 24,
    frameHeight: 24,
    idleFrames: [0, 1, 2, 3],
    walkFrames: [4, 5, 6, 7, 8, 9],
  },
  "pet-dog": {
    textureKey: "pet-dog",
    path: "assets/pets/dungeon-dog.png",
    frameWidth: 32,
    frameHeight: 32,
    idleFrames: [168, 169, 170, 171],
    walkFrames: [172, 173, 174, 175],
  },
} as const satisfies Record<string, PetAssetSpec>;

export type PetAssetId = keyof typeof PET_ASSETS;

export function petAssetFor(defId: string | undefined): PetAssetSpec | undefined {
  return defId ? PET_ASSETS[defId as PetAssetId] : undefined;
}
