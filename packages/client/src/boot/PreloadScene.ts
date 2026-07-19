// Preload scene: loads the atlas, animation manifest, and pixel font, then hands off to the next scene.
import Phaser from "phaser";
import { ASSET_KEYS, ASSET_PATHS } from "./assetManifest.js";
import { registerAnimations, type AnimationManifest } from "./registerAnimations.js";
import { waitForPixelFontReady } from "../ui/font.js";

/** Query param that selects the post-boot scene; defaults to the title/boot placeholder. */
const SCENE_PARAM = "scene";
const GALLERY_SCENE_KEY = "gallery";
const EDITOR_SCENE_KEY = "editor";

export class PreloadScene extends Phaser.Scene {
  private fontReady = false;

  constructor() {
    super("preload");
  }

  preload(): void {
    this.load.atlas(ASSET_KEYS.atlas, ASSET_PATHS.atlasImage, ASSET_PATHS.atlasJson);
    this.load.json(ASSET_KEYS.animations, ASSET_PATHS.animationsJson);
    waitForPixelFontReady().then(() => {
      this.fontReady = true;
    });
  }

  create(): void {
    const manifest = this.cache.json.get(ASSET_KEYS.animations) as AnimationManifest;
    registerAnimations(this.anims, manifest);
    this.waitThenHandOff();
  }

  /** Font loading is async and independent of Phaser's loader; poll one frame at a time. */
  private waitThenHandOff(): void {
    if (!this.fontReady) {
      this.time.delayedCall(10, () => this.waitThenHandOff());
      return;
    }
    const requested = new URLSearchParams(window.location.search).get(SCENE_PARAM);
    if (requested === GALLERY_SCENE_KEY) {
      this.scene.start(GALLERY_SCENE_KEY);
      return;
    }
    if (requested === EDITOR_SCENE_KEY) {
      this.scene.start(EDITOR_SCENE_KEY, this.game.registry.get("editorBoot") as object);
      return;
    }
    this.scene.start("title");
  }
}
