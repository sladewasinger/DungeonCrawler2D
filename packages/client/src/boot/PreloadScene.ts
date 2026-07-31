// Preload scene: loads the atlas, animation manifest, and pixel font, then hands off to the next scene.
import Phaser from "phaser";
import { ASSET_KEYS, ASSET_PATHS } from "./assetManifest.js";
import { registerAnimations, type AnimationManifest } from "./registerAnimations.js";
import { waitForPixelFontReady } from "../ui/foundation/font.js";
import { setViewOrientation } from "../render/view/transform/viewState.js";
import { PET_ASSETS } from "./petAssetManifest.js";
import { testbenchSceneKey } from "../scenes/testbench/testbenchRegistry.js";
import { terrainDebugIsEnabled } from "../render/terrain/runtime/debugMode.js";

/** Query param that selects the post-boot scene; defaults to the title/boot placeholder. */
const SCENE_PARAM = "scene";
const TESTBENCH_PARAM = "testbench";
/** Dev-only startup ViewOrientation override (e.g. `?vo=90`) — useful for gallery
 * captures and renderer regression checks. The dungeon scene also changes this state
 * live through its prewarmed Z/X rotation controller. */
const VIEW_ORIENTATION_PARAM = "vo";
const EDITOR_SCENE_KEY = "editor";
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
    this.load.atlas(ASSET_KEYS.particleAtlas, ASSET_PATHS.particleAtlasImage, ASSET_PATHS.particleAtlasJson);
    this.load.json(ASSET_KEYS.animations, ASSET_PATHS.animationsJson);
    if (terrainDebugIsEnabled(window.location.search)) {
      this.load.image(ASSET_KEYS.debugAtlas, ASSET_PATHS.debugAtlasImage);
    }
    this.load.image(ASSET_KEYS.sharedAtlas, ASSET_PATHS.sharedAtlasImage);
    this.load.image(
      ASSET_KEYS.spawnRoomMegaphone,
      ASSET_PATHS.spawnRoomMegaphoneImage,
    );
    this.load.image(ASSET_KEYS.arenaGate, ASSET_PATHS.arenaGateImage);
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
    if (this.shouldWaitForFont(timedOut)) return;
    this.warnForFontTimeout(timedOut);
    const params = new URLSearchParams(window.location.search);
    const vo = params.get(VIEW_ORIENTATION_PARAM);
    if (vo !== null) setViewOrientation(Number(vo));
    this.startRequestedScene({
      requestedScene: params.get(SCENE_PARAM),
      requestedTestbench: params.get(TESTBENCH_PARAM),
    });
  }

  private shouldWaitForFont(timedOut: boolean): boolean {
    if (this.fontReady || timedOut) return false;
    this.time.delayedCall(FONT_POLL_INTERVAL_MS, () => this.waitThenHandOff());
    return true;
  }

  private warnForFontTimeout(timedOut: boolean): void {
    if (!timedOut || this.fontReady) return;
    console.warn(`[boot] pixel font not ready after ${FONT_READY_TIMEOUT_MS}ms — proceeding with the system font fallback`);
  }

  private startRequestedScene({ requestedScene, requestedTestbench }: SceneRequest): void {
    const startupScene = this.registry.get("startupScene");
    if (typeof startupScene === "string") {
      this.scene.start(startupScene);
      return;
    }
    const testbench = testbenchSceneKey(requestedTestbench);
    if (testbench) {
      this.scene.start(testbench);
      return;
    }
    if (requestedScene === EDITOR_SCENE_KEY) {
      this.scene.start(EDITOR_SCENE_KEY);
      return;
    }
    this.scene.start("title");
  }
}

interface SceneRequest {
  readonly requestedScene: string | null;
  readonly requestedTestbench: string | null;
}

function registerPetAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const [id, spec] of Object.entries(PET_ASSETS)) {
    createPetAnimation({ anims, key: `pet:${id}:idle`, textureKey: spec.textureKey, frames: spec.idleFrames, frameRate: 5 });
    createPetAnimation({ anims, key: `pet:${id}:walk`, textureKey: spec.textureKey, frames: spec.walkFrames, frameRate: 9 });
  }
}

interface PetAnimationRequest {
  readonly anims: Phaser.Animations.AnimationManager;
  readonly key: string;
  readonly textureKey: string;
  readonly frames: readonly number[];
  readonly frameRate: number;
}

function createPetAnimation(request: PetAnimationRequest): void {
  const { anims, key, textureKey, frames, frameRate } = request;
  if (anims.exists(key)) return;
  anims.create({
    key,
    frames: frames.map((frame) => ({ key: textureKey, frame })),
    frameRate,
    repeat: -1,
  });
}
