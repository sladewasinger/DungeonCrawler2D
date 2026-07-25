/** Converts authoritative prediction divergence into a bounded render-only smoothing offset. */
export interface PositionCorrection {
  x: number;
  y: number;
  z: number;
}

interface Position {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const CORRECTION_SMOOTH_THRESHOLD = 0.02;
export const CORRECTION_HARD_THRESHOLD = 1.5;
const DECAY_MS = 140;

function isFinitePosition(position: Position): boolean {
  return Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z);
}

export class PredictionCorrection {
  private readonly offset: PositionCorrection = { x: 0, y: 0, z: 0 };
  private hardSnap = false;
  lastError = 0;

  record(before: Position, after: Position): void {
    if (!isFinitePosition(before) || !isFinitePosition(after)) {
      this.reset(true);
      return;
    }
    const dx = before.x - after.x;
    const dy = before.y - after.y;
    const dz = before.z - after.z;
    this.lastError = Math.hypot(dx, dy, dz);
    if (this.lastError >= CORRECTION_HARD_THRESHOLD) {
      this.clearOffset();
      this.hardSnap = true;
      return;
    }
    if (this.lastError < CORRECTION_SMOOTH_THRESHOLD) return;
    this.offset.x += dx;
    this.offset.y += dy;
    this.offset.z += dz;
  }

  advance(
    deltaMs: number,
    blockedAxes: { readonly x?: boolean; readonly y?: boolean } = {},
  ): PositionCorrection {
    return this.advanceInto(
      deltaMs,
      blockedAxes.x === true,
      blockedAxes.y === true,
      { x: 0, y: 0, z: 0 },
    );
  }

  advanceInto(
    deltaMs: number,
    blockedX: boolean,
    blockedY: boolean,
    output: PositionCorrection,
  ): PositionCorrection {
    const current = this.offset;
    output.x = blockedX ? 0 : current.x;
    output.y = blockedY ? 0 : current.y;
    output.z = current.z;
    const decay = Math.exp(-Math.max(0, deltaMs) / DECAY_MS);
    current.x = blockedX ? 0 : current.x * decay;
    current.y = blockedY ? 0 : current.y * decay;
    current.z *= decay;
    return output;
  }

  consumeHardSnap(): boolean {
    const hardSnap = this.hardSnap;
    this.hardSnap = false;
    return hardSnap;
  }

  reset(hardSnap = false): void {
    this.clearOffset();
    this.hardSnap = hardSnap;
    this.lastError = 0;
  }

  private clearOffset(): void {
    this.offset.x = 0;
    this.offset.y = 0;
    this.offset.z = 0;
  }
}
