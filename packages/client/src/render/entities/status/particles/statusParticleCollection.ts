import type Phaser from "phaser";
import {
  FIRE_SPARK_PARTICLE,
  OIL_DROP_PARTICLE,
  POISON_GAS_PARTICLE,
  type StatusParticleKind,
} from "./statusParticleMotion.js";
import {
  createStatusParticleSlot,
  deactivateStatusParticleSlot,
  type StatusParticleSlot,
} from "./statusParticleSlot.js";
import type { StatusVisualBudget } from "../statusVisualBudget.js";

export function createStatusParticleSlots(
  scene: Phaser.Scene,
  budget: StatusVisualBudget,
): StatusParticleSlot[] {
  return [
    ...createKindSlots(scene, FIRE_SPARK_PARTICLE, budget.fireSparkSlots),
    ...createKindSlots(scene, OIL_DROP_PARTICLE, budget.oilDropSlots),
    ...createKindSlots(scene, POISON_GAS_PARTICLE, budget.poisonGasSlots),
  ];
}

export function availableStatusParticleSlot(
  slots: readonly StatusParticleSlot[],
  kind: StatusParticleKind,
): StatusParticleSlot | null {
  for (const slot of slots) {
    if (!slot.active && slot.kind === kind) return slot;
  }
  return null;
}

export function clearStatusParticleKind(
  slots: readonly StatusParticleSlot[],
  kind: StatusParticleKind,
): void {
  for (const slot of slots) {
    if (slot.active && slot.kind === kind) {
      deactivateStatusParticleSlot(slot);
    }
  }
}

export function resetStatusParticleSlots(
  slots: readonly StatusParticleSlot[],
): void {
  for (const slot of slots) deactivateStatusParticleSlot(slot);
}

export function destroyStatusParticleSlots(
  slots: StatusParticleSlot[],
): void {
  for (const slot of slots) slot.sprite.destroy();
  slots.length = 0;
}

function createKindSlots(
  scene: Phaser.Scene,
  kind: StatusParticleKind,
  count: number,
): StatusParticleSlot[] {
  return Array.from(
    { length: count },
    () => createStatusParticleSlot(scene, kind),
  );
}
