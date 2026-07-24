/** Accumulates authoritative corrections until rendering can translate its interpolation history. */
export interface PositionCorrection {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Position {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const ZERO_CORRECTION: PositionCorrection = { x: 0, y: 0, z: 0 };

export class PredictionCorrection {
  private pending: PositionCorrection = ZERO_CORRECTION;

  record(before: Position, after: Position): void {
    this.pending = {
      x: this.pending.x + after.x - before.x,
      y: this.pending.y + after.y - before.y,
      z: this.pending.z + after.z - before.z,
    };
  }

  consume(): PositionCorrection {
    const correction = this.pending;
    this.pending = ZERO_CORRECTION;
    return correction;
  }

  reset(): void {
    this.pending = ZERO_CORRECTION;
  }
}
