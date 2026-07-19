// Turns the baked animations.json manifest into registered Phaser animations against the atlas texture.
import type Phaser from "phaser";
import { ASSET_KEYS } from "./assetManifest.js";

/** Shape of one entry in public/assets/animations.json. */
export interface AnimationSpec {
  readonly frames: readonly string[];
  readonly frameRate: number;
  readonly repeat: number;
}

/** Shape of the whole animations.json manifest: animation name -> spec. */
export type AnimationManifest = Readonly<Record<string, AnimationSpec>>;

/**
 * Registers every animation in the manifest with `anims`, keyed by its manifest
 * name (e.g. "wizzard_f_idle"). Frame names must already exist in the atlas
 * texture's frame table (loaded via ASSET_KEYS.atlas).
 */
export function registerAnimations(
  anims: Phaser.Animations.AnimationManager,
  manifest: AnimationManifest,
): void {
  for (const [name, spec] of Object.entries(manifest)) {
    if (anims.exists(name)) continue;
    anims.create({
      key: name,
      frames: spec.frames.map((frame) => ({ key: ASSET_KEYS.atlas, frame })),
      frameRate: spec.frameRate,
      repeat: spec.repeat,
    });
  }
}
