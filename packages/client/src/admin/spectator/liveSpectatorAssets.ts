import { buildAssetPath } from "../../boot/assetManifest.js";

export interface LiveSpectatorAssets {
  readonly atlas: HTMLImageElement;
  readonly terrain: HTMLImageElement;
}

export function createLiveSpectatorAssets(onLoad: () => void): LiveSpectatorAssets {
  const atlas = new Image();
  const terrain = new Image();
  atlas.addEventListener("load", onLoad);
  terrain.addEventListener("load", onLoad);
  atlas.src = buildAssetPath("assets/atlas.png");
  terrain.src = buildAssetPath("assets/terrain/shared-atlas.png");
  return { atlas, terrain };
}
