// Per-torch flame-lick pool: one cheap emitter per active torch light, created once
// (torches don't move) and destroyed when its chunk streams back out — mirrors
// LightSpritePool's id-keyed sync shape.
import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import type { LightSource } from "../render/lighting/lightSource.js";
import { createTorchFlame } from "./particleRecipes.js";

const MAX_SPARE_FLAMES = 24;

export class TorchFlamePool {
  private readonly emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly spare: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private readonly seen = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  sync(torches: readonly LightSource[]): void {
    const seen = this.seen;
    seen.clear();
    for (const torch of torches) {
      seen.add(torch.id);
      if (this.emitters.has(torch.id)) continue;
      const screen = worldToScreen(torch.x, torch.y);
      this.emitters.set(torch.id, this.acquire(screen.x, screen.y));
    }
    for (const [id, emitter] of this.emitters) {
      if (seen.has(id)) continue;
      this.release(emitter);
      this.emitters.delete(id);
    }
  }

  private acquire(x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.spare.pop() ?? createTorchFlame(this.scene, x, y);
    emitter.setPosition(x, y).setActive(true).setVisible(true).start();
    return emitter;
  }

  private release(emitter: Phaser.GameObjects.Particles.ParticleEmitter): void {
    emitter.stop();
    emitter.killAll();
    if (this.spare.length >= MAX_SPARE_FLAMES) {
      emitter.destroy();
      return;
    }
    emitter.setActive(false).setVisible(false);
    this.spare.push(emitter);
  }

  dispose(): void {
    for (const emitter of this.emitters.values()) emitter.destroy();
    for (const emitter of this.spare) emitter.destroy();
    this.emitters.clear();
    this.spare.length = 0;
  }
}
