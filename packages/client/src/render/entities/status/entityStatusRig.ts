import Phaser from "phaser";
import { ASSET_KEYS } from "../../../boot/assetManifest.js";
import { EntityStatusParticles } from "./entityStatusParticles.js";
import type { StatusVisualBudget } from "./statusVisualBudget.js";
import type { StatusVisualFrame } from "./statusVisualFrame.js";
import type { StatusVisualRig } from "./statusVisualRig.js";

const EFFECT_FRAME = "light_soft";
const FIRE_COLOR = 0xff9e3d;
const OIL_COLOR = 0x17121b;

export class PhaserStatusVisualRig implements StatusVisualRig {
  private readonly flame: Phaser.GameObjects.Sprite;
  private readonly oilHigh: Phaser.GameObjects.Sprite;
  private readonly oilLow: Phaser.GameObjects.Sprite;
  private readonly particles: EntityStatusParticles;
  private seed = 0;

  constructor(scene: Phaser.Scene, budget: StatusVisualBudget) {
    this.flame = createFlame(scene);
    this.oilHigh = createOilStreak(scene);
    this.oilLow = createOilStreak(scene);
    this.particles = new EntityStatusParticles(scene, budget);
  }

  activate(seed: number): void {
    this.reset();
    this.seed = seed;
    this.particles.activate(seed);
  }

  sync(
    body: Phaser.GameObjects.Sprite,
    frame: StatusVisualFrame,
  ): void {
    this.syncFlame(body, frame);
    this.syncOil(body, frame.oiled);
    this.particles.sync(body, frame);
  }

  private syncFlame(body: Phaser.GameObjects.Sprite, frame: StatusVisualFrame): void {
    this.flame.setVisible(frame.burning).setActive(frame.burning);
    if (!frame.burning) return;
    const pulse = 1 + Math.sin(frame.nowMs / 90 + this.seed) * 0.08;
    const scale = Math.max(0.18, (body.displayHeight / 64) * 0.55 * pulse);
    this.flame.setPosition(body.x, body.y - body.displayHeight * 0.08);
    this.flame.setDepth(body.depth + 0.05).setScale(scale, scale * 1.35);
    this.flame.setAlpha(0.62 + Math.sin(frame.nowMs / 120 + this.seed * 0.7) * 0.1);
  }

  private syncOil(body: Phaser.GameObjects.Sprite, visible: boolean): void {
    this.oilHigh.setVisible(visible).setActive(visible);
    this.oilLow.setVisible(visible).setActive(visible);
    if (!visible) return;
    const side = body.flipX ? -1 : 1;
    const scale = Math.max(0.08, body.displayHeight / 64);
    this.oilHigh.setPosition(body.x + side * body.displayWidth * 0.18, body.y - body.displayHeight * 0.55);
    this.oilLow.setPosition(body.x - side * body.displayWidth * 0.12, body.y - body.displayHeight * 0.28);
    this.oilHigh.setDepth(body.depth + 0.04).setScale(scale * 0.11, scale * 0.3);
    this.oilLow.setDepth(body.depth + 0.04).setScale(scale * 0.15, scale * 0.22);
  }

  reset(): void {
    this.flame.setVisible(false).setActive(false);
    this.oilHigh.setVisible(false).setActive(false);
    this.oilLow.setVisible(false).setActive(false);
    this.particles.reset();
  }

  destroy(): void {
    this.flame.destroy();
    this.oilHigh.destroy();
    this.oilLow.destroy();
    this.particles.destroy();
  }
}

function createFlame(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
  return scene.add.sprite(0, 0, ASSET_KEYS.atlas, EFFECT_FRAME)
    .setOrigin(0.5, 1)
    .setTint(FIRE_COLOR)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setVisible(false)
    .setActive(false);
}

function createOilStreak(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
  return scene.add.sprite(0, 0, ASSET_KEYS.atlas, EFFECT_FRAME)
    .setOrigin(0.5)
    .setTint(OIL_COLOR)
    .setBlendMode(Phaser.BlendModes.MULTIPLY)
    .setAlpha(0.42)
    .setVisible(false)
    .setActive(false);
}
