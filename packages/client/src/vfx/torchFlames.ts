// Per-torch flame-lick pool: one cheap emitter per active torch light, created once
// (torches don't move) and destroyed when its chunk streams back out — mirrors
// LightSpritePool's id-keyed sync shape.
import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import type { LightSource } from "../render/lighting/lightSource.js";
import { createTorchFlame } from "./particleRecipes.js";

export class TorchFlamePool {
  private readonly emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private readonly scene: Phaser.Scene) {}

  sync(torches: readonly LightSource[]): void {
    const seen = new Set<string>();
    for (const torch of torches) {
      seen.add(torch.id);
      if (this.emitters.has(torch.id)) continue;
      const screen = worldToScreen(torch.x, torch.y);
      this.emitters.set(torch.id, createTorchFlame(this.scene, screen.x, screen.y));
    }
    for (const [id, emitter] of this.emitters) {
      if (seen.has(id)) continue;
      emitter.destroy();
      this.emitters.delete(id);
    }
  }

  dispose(): void {
    for (const emitter of this.emitters.values()) emitter.destroy();
    this.emitters.clear();
  }
}
