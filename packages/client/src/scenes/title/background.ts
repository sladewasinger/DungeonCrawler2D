// Title screen background: a near-black stone void, a torchlit door composite built
// from the same 0x72 door pieces render/terrain/structures.ts uses in-world, and slow
// drifting embers — VISUAL_DIRECTION's palette and lighting language, just standing in
// for gameplay before the player has connected.
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { flickerAlpha, flickerScale } from "../../render/lighting/lightSource.js";

const VOID_COLOR = 0x14141c;
const TORCH_COLOR = 0xff9e3d;
const LIGHT_FRAME = "light_soft";
const LIGHT_SOURCE_PX = 64;
const GLOW_RADIUS_TILES = 2.6;
const GLOW_SEED = 7;

export class TitleBackground {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly door: Phaser.GameObjects.Container;
  private readonly glow: Phaser.GameObjects.Sprite;
  private readonly embers: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly scene: Phaser.Scene) {
    this.bg = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, VOID_COLOR).setOrigin(0, 0).setDepth(0);
    this.door = this.buildDoor();
    this.glow = scene.add
      .sprite(0, 0, ASSET_KEYS.atlas, LIGHT_FRAME)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(TORCH_COLOR)
      .setDepth(2);
    this.embers = this.buildEmbers();
    this.layout(scene.scale.width, scene.scale.height);
  }

  private buildDoor(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0).setDepth(2);
    const piece = (frame: string, dx: number, dy: number) =>
      this.scene.add.sprite(dx, dy, ASSET_KEYS.atlas, frame).setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE);
    container.add([
      piece("doors_leaf_closed", 0, 0),
      piece("doors_frame_left", -SCREEN_TILE_PX * 1.5, 0),
      piece("doors_frame_right", SCREEN_TILE_PX * 1.5, 0),
      piece("doors_frame_top", 0, -2 * SCREEN_TILE_PX),
    ]);
    return container;
  }

  private buildEmbers(): Phaser.GameObjects.Particles.ParticleEmitter {
    return this.scene.add
      .particles(0, 0, ASSET_KEYS.atlas, {
        frame: LIGHT_FRAME,
        x: { min: 0, max: this.scene.scale.width },
        y: this.scene.scale.height + 10,
        lifespan: 7000,
        speedY: { min: -14, max: -30 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.11, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: TORCH_COLOR,
        frequency: 90,
        blendMode: "ADD",
      })
      .setDepth(1);
  }

  /** Repositions everything for the current viewport size — call on create and on resize. */
  layout(width: number, height: number): void {
    this.bg.setSize(width, height).setPosition(0, 0);
    const doorX = width / 2;
    const doorY = height * 0.64;
    this.door.setPosition(doorX, doorY);
    this.glow.setPosition(doorX, doorY - SCREEN_TILE_PX * 1.6);
  }

  /** Flickers the door's torch glow — the embers animate on their own via the particle config. */
  update(nowMs: number): void {
    const scale = ((GLOW_RADIUS_TILES * 2 * SCREEN_TILE_PX) / LIGHT_SOURCE_PX) * flickerScale(nowMs, GLOW_SEED);
    this.glow.setScale(scale);
    this.glow.setAlpha(0.5 * flickerAlpha(nowMs, GLOW_SEED));
  }

  dispose(): void {
    this.bg.destroy();
    this.door.destroy();
    this.glow.destroy();
    this.embers.destroy();
  }
}
