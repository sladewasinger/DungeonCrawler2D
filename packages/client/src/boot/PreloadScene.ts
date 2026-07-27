// Preload scene: loads the atlas, animation manifest, and pixel font, then hands off to the next scene.
import Phaser from "phaser";
import { ASSET_KEYS, ASSET_PATHS } from "./assetManifest.js";
import { registerAnimations, type AnimationManifest } from "./registerAnimations.js";
import { waitForPixelFontReady } from "../ui/font.js";
import { DEBUG_TILE_PX, DEBUG_TILESET_KEY, DEBUG_TILESET_PATH } from "../render/terrain/debugTileset.js";
import { setViewOrientation } from "../render/view/viewState.js";
import { PET_ASSETS } from "./petAssetManifest.js";

/** Query param that selects the post-boot scene; defaults to the title/boot placeholder. */
const SCENE_PARAM = "scene";
/** Dev-only startup ViewOrientation override (e.g. `?vo=90`) — useful for gallery
 * captures and renderer regression checks. The dungeon scene also changes this state
 * live through its prewarmed Q/X rotation controller. */
const VIEW_ORIENTATION_PARAM = "vo";
const GALLERY_SCENE_KEY = "gallery";
const EDITOR_SCENE_KEY = "editor";
const AUTOTILE_GALLERY_SCENE_KEY = "autotile-gallery";
/** Hard cap on waiting for the pixel font: some mobile browsers never resolve
 * `document.fonts.ready` (font.ts) in the way desktop Chrome does — a system-font
 * fallback beats an indefinite black screen. */
const FONT_READY_TIMEOUT_MS = 2500;
const FONT_POLL_INTERVAL_MS = 10;

export class PreloadScene extends Phaser.Scene {
  private fontReady = false;
  private bootStartedAtMs = 0;

  constructor() {
    super("preload");
  }

  preload(): void {
    this.load.atlas(ASSET_KEYS.atlas, ASSET_PATHS.atlasImage, ASSET_PATHS.atlasJson);
    this.load.json(ASSET_KEYS.animations, ASSET_PATHS.animationsJson);
    this.load.image(ASSET_KEYS.terrain4Debug, ASSET_PATHS.terrain4DebugImage);
    this.load.image(ASSET_KEYS.terrain4Biomes, ASSET_PATHS.terrain4BiomesImage);
    this.load.image(ASSET_KEYS.terrain4Pillars, ASSET_PATHS.terrain4PillarsImage);
    this.load.image(ASSET_KEYS.terrain4Cliffs, ASSET_PATHS.terrain4CliffsImage);
    this.load.image(ASSET_KEYS.terrain4CliffsDebug, ASSET_PATHS.terrain4CliffsDebugImage);
    this.load.spritesheet(DEBUG_TILESET_KEY, DEBUG_TILESET_PATH, {
      frameWidth: DEBUG_TILE_PX,
      frameHeight: DEBUG_TILE_PX,
    });
    for (const spec of Object.values(PET_ASSETS)) {
      this.load.spritesheet(spec.textureKey, spec.path, {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
      });
    }
    waitForPixelFontReady().then(() => {
      this.fontReady = true;
    });
  }

  create(): void {
    const manifest = this.cache.json.get(ASSET_KEYS.animations) as AnimationManifest;
    registerAnimations(this.anims, manifest);
    registerPetAnimations(this.anims);
    this.bootStartedAtMs = this.time.now;
    this.waitThenHandOff();
  }

  /** Font loading is async and independent of Phaser's loader; poll one frame at a
   * time, up to FONT_READY_TIMEOUT_MS, then proceed regardless. */
  private waitThenHandOff(): void {
    const timedOut = this.time.now - this.bootStartedAtMs >= FONT_READY_TIMEOUT_MS;
    if (!this.fontReady && !timedOut) {
      this.time.delayedCall(FONT_POLL_INTERVAL_MS, () => this.waitThenHandOff());
      return;
    }
    if (timedOut && !this.fontReady) {
      console.warn(`[boot] pixel font not ready after ${FONT_READY_TIMEOUT_MS}ms — proceeding with the system font fallback`);
    }
    const params = new URLSearchParams(window.location.search);
    const vo = params.get(VIEW_ORIENTATION_PARAM);
    if (vo !== null) setViewOrientation(Number(vo));
    const requested = params.get(SCENE_PARAM);
    if (requested === GALLERY_SCENE_KEY) {
      this.scene.start(GALLERY_SCENE_KEY);
      return;
    }
    if (requested === EDITOR_SCENE_KEY) {
      this.scene.start(EDITOR_SCENE_KEY, this.game.registry.get("editorBoot") as object);
      return;
    }
    if (requested === AUTOTILE_GALLERY_SCENE_KEY) {
      this.scene.start(AUTOTILE_GALLERY_SCENE_KEY);
      return;
    }
    this.scene.start("title");
  }
}

function registerPetAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const [id, spec] of Object.entries(PET_ASSETS)) {
    createPetAnimation(anims, `pet:${id}:idle`, spec.textureKey, spec.idleFrames, 5);
    createPetAnimation(anims, `pet:${id}:walk`, spec.textureKey, spec.walkFrames, 9);
  }
}

function createPetAnimation(
  anims: Phaser.Animations.AnimationManager,
  key: string,
  textureKey: string,
  frames: readonly number[],
  frameRate: number,
): void {
  if (anims.exists(key)) return;
  anims.create({
    key,
    frames: frames.map((frame) => ({ key: textureKey, frame })),
    frameRate,
    repeat: -1,
  });
}
