// Additive colored-glow sprite pool for every active light source: one Phaser sprite per
// id, reused across frames (never recreated), tinted per light and gently flickering.
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { flickerAlpha, flickerScale, type LightSource } from "./lightSource.js";

const LIGHT_FRAME = "light_soft";
const LIGHT_SOURCE_PX = 64;
const LIGHT_POOL_DEPTH = 200_000;
/** Kept modest (not a bright opaque wash) — darkness's erase already restores full natural brightness within the hole; this layer only adds the color cast, so it never flattens an entity's silhouette when a light sits right on top of one. */
const BASE_ALPHA = 0.3;

export class LightSpritePool {
  private readonly sprites = new Map<string, Phaser.GameObjects.Sprite>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Syncs the pool to exactly the given light sources — creates/updates/destroys sprites to match. */
  sync(lights: readonly LightSource[], nowMs: number): void {
    const seen = new Set<string>();
    for (const light of lights) {
      seen.add(light.id);
      this.place(this.getOrCreate(light.id), light, nowMs);
    }
    for (const [id, sprite] of this.sprites) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.sprites.delete(id);
    }
  }

  private getOrCreate(id: string): Phaser.GameObjects.Sprite {
    const existing = this.sprites.get(id);
    if (existing) return existing;
    const sprite = this.scene.add
      .sprite(0, 0, ASSET_KEYS.atlas, LIGHT_FRAME)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(LIGHT_POOL_DEPTH)
      .setOrigin(0.5, 0.5);
    this.sprites.set(id, sprite);
    return sprite;
  }

  private place(sprite: Phaser.GameObjects.Sprite, light: LightSource, nowMs: number): void {
    const scale = ((light.radiusTiles * 2 * SCREEN_TILE_PX) / LIGHT_SOURCE_PX) * flickerScale(nowMs, light.seed);
    sprite.setPosition(light.x * SCREEN_TILE_PX, light.y * SCREEN_TILE_PX);
    sprite.setScale(scale);
    sprite.setTint(light.color);
    sprite.setAlpha(Math.min(1, BASE_ALPHA * flickerAlpha(nowMs, light.seed)));
  }

  dispose(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
  }
}
