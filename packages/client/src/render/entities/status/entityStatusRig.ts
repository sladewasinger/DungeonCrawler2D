import Phaser from "phaser";
import { ASSET_KEYS } from "../../../boot/assetManifest.js";
import {
  AREA_ACTOR_FIRE_FLAMES,
  AREA_FIRE_BASE_FLAME,
} from "../../../vfx/areas/presentation/areaVisualStyle.js";
import { EntityStatusParticles } from "./entityStatusParticles.js";
import {
  statusFlameAlpha,
  statusFlameDepth,
  statusFlameOffset,
} from "./statusFlamePresentation.js";
import type { StatusVisualBudget } from "./statusVisualBudget.js";
import type { StatusVisualFrame } from "./statusVisualFrame.js";
import type { StatusVisualRig } from "./statusVisualRig.js";

const EFFECT_FRAME = "light_soft";
const FIRE_FRAME = "area_fire_flame";
const OIL_COLOR = 0x17121b;

interface AttachedFlame {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly index: number;
}

export class PhaserStatusVisualRig implements StatusVisualRig {
  private readonly flames: readonly AttachedFlame[];
  private readonly oilHigh: Phaser.GameObjects.Sprite;
  private readonly oilLow: Phaser.GameObjects.Sprite;
  private readonly particles: EntityStatusParticles;
  private seed = 0;

  constructor(scene: Phaser.Scene, budget: StatusVisualBudget) {
    this.flames = createFlames(scene);
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
    for (const flame of this.flames) this.syncAttachedFlame(flame, body, frame);
  }

  private syncAttachedFlame(
    flame: AttachedFlame,
    body: Phaser.GameObjects.Sprite,
    frame: StatusVisualFrame,
  ): void {
    const sprite = flame.sprite;
    sprite.setVisible(frame.burning).setActive(frame.burning);
    if (!frame.burning) return;
    const offset = statusFlameOffset(flame.index);
    sprite
      .setPosition(
        body.x + body.displayWidth * (offset[0] ?? 0),
        body.y + body.displayHeight * (offset[1] ?? -0.5),
      )
      .setDepth(statusFlameDepth(body.depth))
      .setScale(AREA_ACTOR_FIRE_FLAMES.scale)
      .setAlpha(statusFlameAlpha(this.seed, flame.index, frame.nowMs));
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
    for (const flame of this.flames) {
      flame.sprite.setVisible(false).setActive(false);
    }
    this.oilHigh.setVisible(false).setActive(false);
    this.oilLow.setVisible(false).setActive(false);
    this.particles.reset();
  }

  destroy(): void {
    for (const flame of this.flames) flame.sprite.destroy();
    this.oilHigh.destroy();
    this.oilLow.destroy();
    this.particles.destroy();
  }
}

function createFlames(scene: Phaser.Scene): AttachedFlame[] {
  return Array.from(
    { length: AREA_ACTOR_FIRE_FLAMES.count },
    (_, index) => ({ sprite: createFlame(scene), index }),
  );
}

function createFlame(scene: Phaser.Scene): Phaser.GameObjects.Sprite {
  return scene.add.sprite(0, 0, ASSET_KEYS.atlas, FIRE_FRAME)
    .setOrigin(0.5)
    .setTint(AREA_FIRE_BASE_FLAME.color)
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
