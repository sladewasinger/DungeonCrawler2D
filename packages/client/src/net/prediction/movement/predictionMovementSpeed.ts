import {
  advanceContinuousMovementSpeed,
  initialContinuousMovementSpeedState,
  TICK_DT,
  type ContinuousMovementSpeedProjection,
  type ContinuousMovementSpeedState,
} from "@dc2d/engine";

/** Keeps the local movement projection aligned with its authoritative anchor. */
export class PredictionMovementSpeed {
  private projection: ContinuousMovementSpeedProjection | null = null;
  private state: ContinuousMovementSpeedState | null = null;

  reset(): void {
    this.projection = null;
    this.state = null;
  }

  ensure(projection: ContinuousMovementSpeedProjection | undefined): void {
    if (!this.state && projection) this.replace(projection);
  }

  replace(projection: ContinuousMovementSpeedProjection | undefined): void {
    this.projection = projection ?? null;
    this.state = projection ? initialContinuousMovementSpeedState(projection) : null;
  }

  current(fallback: number): number {
    return this.state?.speed ?? fallback;
  }

  advance(): void {
    if (!this.state || !this.projection) return;
    this.state = advanceContinuousMovementSpeed({
      speed: this.state.speed,
      statuses: this.state.statuses,
      statusDefinition: this.projection.statusDefinition,
      tickDuration: TICK_DT,
    });
  }
}
