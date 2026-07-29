import type Phaser from "phaser";
import {
  availableStatusParticleSlot,
  clearStatusParticleKind,
  createStatusParticleSlots,
  destroyStatusParticleSlots,
  resetStatusParticleSlots,
} from "./particles/statusParticleCollection.js";
import {
  FIRE_SPARK_PARTICLE,
  OIL_DROP_PARTICLE,
  POISON_GAS_PARTICLE,
  type StatusParticleKind,
} from "./particles/statusParticleMotion.js";
import { StatusParticleScheduler } from "./particles/statusParticleScheduler.js";
import {
  activateStatusParticleSlot,
  syncStatusParticleSlot,
} from "./particles/statusParticleSlot.js";
import type { StatusVisualBudget } from "./statusVisualBudget.js";
import type { StatusVisualFrame } from "./statusVisualFrame.js";

export class EntityStatusParticles {
  private readonly slots;
  private readonly scheduler: StatusParticleScheduler;
  private sequence = 0;
  private seed = 0;

  constructor(scene: Phaser.Scene, budget: StatusVisualBudget) {
    this.slots = createStatusParticleSlots(scene, budget);
    this.scheduler = new StatusParticleScheduler(budget);
  }

  activate(seed: number): void {
    this.reset();
    this.seed = seed;
  }

  sync(body: Phaser.GameObjects.Sprite, frame: StatusVisualFrame): void {
    this.clearInactiveKinds(frame);
    for (const slot of this.slots) {
      syncStatusParticleSlot(slot, body, frame);
    }
    this.spawnDue(body, frame);
  }

  private spawnDue(
    body: Phaser.GameObjects.Sprite,
    frame: StatusVisualFrame,
  ): void {
    const input = { body, nowMs: frame.nowMs };
    this.spawnIfDue(FIRE_SPARK_PARTICLE, frame.burning, input);
    this.spawnIfDue(OIL_DROP_PARTICLE, frame.oiled, input);
    this.spawnIfDue(POISON_GAS_PARTICLE, frame.poisoned, input);
  }

  private spawnIfDue(
    kind: StatusParticleKind,
    enabled: boolean,
    input: StatusParticleSpawn,
  ): void {
    if (!this.scheduler.due(kind, enabled, input.nowMs)) return;
    const slot = availableStatusParticleSlot(this.slots, kind);
    if (!slot) return;
    activateStatusParticleSlot(slot, {
      body: input.body,
      nowMs: input.nowMs,
      seed: this.seed,
      sequence: this.sequence++,
    });
  }

  private clearInactiveKinds(frame: StatusVisualFrame): void {
    if (!frame.burning) clearStatusParticleKind(this.slots, FIRE_SPARK_PARTICLE);
    if (!frame.oiled) clearStatusParticleKind(this.slots, OIL_DROP_PARTICLE);
    if (!frame.poisoned) clearStatusParticleKind(this.slots, POISON_GAS_PARTICLE);
  }

  reset(): void {
    this.scheduler.reset();
    this.sequence = 0;
    resetStatusParticleSlots(this.slots);
  }

  destroy(): void {
    destroyStatusParticleSlots(this.slots);
  }
}

interface StatusParticleSpawn {
  readonly body: Phaser.GameObjects.Sprite;
  readonly nowMs: number;
}
