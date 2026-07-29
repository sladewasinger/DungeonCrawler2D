import type Phaser from "phaser";
import { ASSET_KEYS } from "../../../boot/assetManifest.js";
import { lightingColor, LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

const ATMOSPHERE = LIGHTING_VISUAL_STYLE.atmosphere;

export interface AtmosphericMotesFrame {
  readonly enabled: boolean;
  readonly depth: number;
}

/** One bounded emitter for the whole visible dungeon; rooms and reduced motion disable it. */
export class AtmosphericMotes {
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter | null;
  private width = 0;
  private height = 0;
  private emitting = false;

  constructor(
    private readonly scene: Phaser.Scene,
    maximumParticles: number,
  ) {
    this.emitter = maximumParticles > 0
      ? createEmitter(scene, maximumParticles)
      : null;
  }

  update(frame: AtmosphericMotesFrame): void {
    if (!this.emitter) return;
    this.resizeIfNeeded();
    this.emitter.setDepth(frame.depth + 0.05)
      .setVisible(frame.enabled);
    this.setEmitting(frame.enabled);
  }

  dispose(): void {
    this.emitter?.destroy();
  }

  private resizeIfNeeded(): void {
    const { width, height } = this.scene.cameras.main;
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.emitter?.setConfig(emitterConfig(width, height, this.emitter.maxAliveParticles));
  }

  private setEmitting(enabled: boolean): void {
    if (!this.emitter || this.emitting === enabled) return;
    this.emitting = enabled;
    if (enabled) this.emitter.start();
    else this.emitter.stop(true);
  }
}

function createEmitter(
  scene: Phaser.Scene,
  maximumParticles: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const { width, height } = scene.cameras.main;
  return scene.add.particles(0, 0, ASSET_KEYS.atlas, emitterConfig(width, height, maximumParticles))
    .setScrollFactor(0);
}

function emitterConfig(
  width: number,
  height: number,
  maximumParticles: number,
): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
  return {
    frame: ATMOSPHERE.particleFrame,
    x: { min: 0, max: width },
    y: { min: 0, max: height },
    lifespan: ATMOSPHERE.lifespanMs,
    speed: { min: ATMOSPHERE.speedPxPerSecond * 0.4, max: ATMOSPHERE.speedPxPerSecond },
    angle: { min: 215, max: 325 },
    scale: { start: ATMOSPHERE.scale, end: ATMOSPHERE.scale * 0.6 },
    alpha: { start: ATMOSPHERE.alpha, end: 0 },
    tint: lightingColor(ATMOSPHERE.color),
    frequency: ATMOSPHERE.frequencyMs,
    maxAliveParticles: maximumParticles,
  };
}
