// Additive colored-glow sprite pool for every active light source: one Phaser sprite per
// id, reused across frames (never recreated), tinted per light and gently flickering.
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { groundToScreen } from "../../entities/geometry/worldToScreen.js";
import { torchHaloFade } from "./haloFade.js";
import { lightHaloPresentation } from "./lightHaloPresentation.js";
import { flickerAlpha, flickerScale, type LightSource } from "./lightSource.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

const LIGHT_FRAME = "light_soft";
const LIGHT_SOURCE_PX = 64;
const MAX_SPARE_LIGHTS =
  LIGHTING_VISUAL_STYLE.streaming.maximumSpareLights;
const BASE_ALPHA = LIGHTING_VISUAL_STYLE.halo.baseAlpha;

interface LightSpriteFrame {
  readonly lights: readonly LightSource[];
  readonly nowMs: number;
  readonly overlayDepth: number;
}

interface LightPlacement {
  readonly light: LightSource;
  readonly nowMs: number;
  readonly overlayDepth: number;
}

export class LightSpritePool {
  private readonly sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly visibleSinceMs = new Map<string, number>();
  private readonly spare: Phaser.GameObjects.Sprite[] = [];
  private readonly seen = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Syncs the pool to exactly the given light sources — creates/updates/destroys sprites to match. */
  sync(frame: LightSpriteFrame): void {
    this.syncIncoming(frame);
    this.releaseAbsent();
  }

  private syncIncoming(frame: LightSpriteFrame): void {
    this.seen.clear();
    for (const light of frame.lights) {
      this.syncLight(light, frame.nowMs, frame.overlayDepth);
    }
  }

  private syncLight(
    light: LightSource,
    nowMs: number,
    overlayDepth: number,
  ): void {
    this.seen.add(light.id);
    if (!this.visibleSinceMs.has(light.id)) this.visibleSinceMs.set(light.id, nowMs);
    this.place(this.getOrCreate(light.id), {
      light,
      nowMs,
      overlayDepth,
    });
  }

  private releaseAbsent(): void {
    for (const [id, sprite] of this.sprites) {
      if (this.seen.has(id)) continue;
      this.release(sprite);
      this.sprites.delete(id);
      this.visibleSinceMs.delete(id);
    }
  }

  private getOrCreate(id: string): Phaser.GameObjects.Sprite {
    const existing = this.sprites.get(id);
    if (existing) return existing;
    const sprite = this.spare.pop() ?? this.create();
    sprite.setActive(true).setVisible(true);
    this.sprites.set(id, sprite);
    return sprite;
  }

  private create(): Phaser.GameObjects.Sprite {
    return this.scene.add.sprite(0, 0, ASSET_KEYS.atlas, LIGHT_FRAME)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setOrigin(0.5, 0.5);
  }

  private release(sprite: Phaser.GameObjects.Sprite): void {
    if (this.spare.length >= MAX_SPARE_LIGHTS) {
      sprite.destroy();
      return;
    }
    sprite.setActive(false).setVisible(false);
    this.spare.push(sprite);
  }

  private place(
    sprite: Phaser.GameObjects.Sprite,
    placement: LightPlacement,
  ): void {
    const { light, nowMs, overlayDepth } = placement;
    const presentation = lightHaloPresentation(light);
    const scale = ((presentation.radiusTiles * 2 * SCREEN_TILE_PX) / LIGHT_SOURCE_PX) *
      flickerScale(nowMs, light.seed) *
      presentation.scaleMultiplier;
    const screen = groundToScreen(
      light.x,
      light.y,
      light.groundHeight ?? 0,
    );
    sprite.setPosition(screen.x, screen.y).setDepth(overlayDepth);
    sprite.setScale(scale);
    sprite.setTint(light.color);
    const fade = light.kind === "torch"
      ? torchHaloFade(nowMs, this.visibleSinceMs.get(light.id) ?? nowMs)
      : 1;
    sprite.setAlpha(Math.min(
      1,
      BASE_ALPHA *
        presentation.alphaMultiplier *
        flickerAlpha(nowMs, light.seed) *
        fade,
    ));
  }

  dispose(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    for (const sprite of this.spare) sprite.destroy();
    this.sprites.clear();
    this.visibleSinceMs.clear();
    this.spare.length = 0;
  }
}
