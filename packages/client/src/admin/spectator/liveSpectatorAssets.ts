import { buildAssetPath } from "../../boot/assetManifest.js";
import { PET_ASSETS } from "../../boot/petAssetManifest.js";

export interface LiveSpectatorAssets {
  readonly atlas: HTMLImageElement;
  readonly terrain: HTMLImageElement;
  readonly pets: Readonly<Record<string, HTMLImageElement>>;
}

export function createLiveSpectatorAssets(onLoad: () => void): LiveSpectatorAssets {
  const atlas = new Image();
  const terrain = new Image();
  atlas.addEventListener("load", onLoad);
  terrain.addEventListener("load", onLoad);
  atlas.src = buildAssetPath("assets/atlas.png");
  terrain.src = buildAssetPath("assets/terrain/shared-atlas.png");
  const pets = Object.fromEntries(Object.entries(PET_ASSETS).map(([id, spec]) => {
    const image = new Image();
    image.addEventListener("load", onLoad);
    image.src = spec.path;
    return [id, image];
  }));
  return { atlas, terrain, pets };
}
