import {
  FIRE_SPARK_PARTICLE,
  OIL_DROP_PARTICLE,
  POISON_GAS_PARTICLE,
  type StatusParticleKind,
} from "./statusParticleMotion.js";
import type { StatusVisualBudget } from "../statusVisualBudget.js";

export class StatusParticleScheduler {
  private readonly nextAt = new Map<StatusParticleKind, number>([
    [FIRE_SPARK_PARTICLE, 0],
    [OIL_DROP_PARTICLE, 0],
    [POISON_GAS_PARTICLE, 0],
  ]);

  constructor(private readonly budget: StatusVisualBudget) {}

  due(
    kind: StatusParticleKind,
    enabled: boolean,
    nowMs: number,
  ): boolean {
    if (!enabled) {
      this.nextAt.set(kind, 0);
      return false;
    }
    const nextAtMs = this.nextAt.get(kind) ?? 0;
    if (nowMs < nextAtMs) return false;
    this.nextAt.set(kind, nowMs + this.intervalFor(kind));
    return true;
  }

  reset(): void {
    for (const kind of this.nextAt.keys()) this.nextAt.set(kind, 0);
  }

  private intervalFor(kind: StatusParticleKind): number {
    if (kind === FIRE_SPARK_PARTICLE) {
      return this.budget.fireSparkIntervalMs;
    }
    if (kind === POISON_GAS_PARTICLE) {
      return this.budget.poisonGasIntervalMs;
    }
    return this.budget.oilDropIntervalMs;
  }
}
