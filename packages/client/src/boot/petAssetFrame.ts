import { petAssetFor } from "./petAssetManifest.js";

export interface PetAssetFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Resolves the first configured idle frame from a pet's sprite sheet. */
export function petIdleFrame(
  defId: string | undefined,
  imageWidth: number,
): PetAssetFrame | null {
  const spec = petAssetFor(defId);
  const frame = spec?.idleFrames[0];
  if (!spec || frame === undefined || imageWidth < spec.frameWidth) return null;
  const columns = Math.max(1, Math.floor(imageWidth / spec.frameWidth));
  return {
    x: frame % columns * spec.frameWidth,
    y: Math.floor(frame / columns) * spec.frameHeight,
    width: spec.frameWidth,
    height: spec.frameHeight,
  };
}
