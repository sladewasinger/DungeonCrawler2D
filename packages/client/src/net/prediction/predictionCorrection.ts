/** Converts authoritative prediction divergence into a bounded render-only smoothing offset. */
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

export const CORRECTION_SMOOTH_THRESHOLD = 0.02;
export const CORRECTION_HARD_THRESHOLD = 1.5;
const DECAY_MS = 140;
const ZERO_CORRECTION: PositionCorrection = { x: 0, y: 0, z: 0 };

function isFinitePosition(position: Position): boolean {
  return Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z);
}

export class PredictionCorrection {
  private offset: PositionCorrection = ZERO_CORRECTION;
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
      this.offset = ZERO_CORRECTION;
      this.hardSnap = true;
      return;
    }
    if (this.lastError < CORRECTION_SMOOTH_THRESHOLD) return;
    this.offset = {
      x: this.offset.x + dx,
      y: this.offset.y + dy,
      z: this.offset.z + dz,
    };
  }

  advance(
    deltaMs: number,
    blockedAxes: { readonly x?: boolean; readonly y?: boolean } = {},
  ): PositionCorrection {
    const current = this.offset;
    const decay = Math.exp(-Math.max(0, deltaMs) / DECAY_MS);
    this.offset = {
      x: blockedAxes.x ? 0 : current.x * decay,
      y: blockedAxes.y ? 0 : current.y * decay,
      z: current.z * decay,
    };
    return {
      x: blockedAxes.x ? 0 : current.x,
      y: blockedAxes.y ? 0 : current.y,
      z: current.z,
    };
  }

  consumeHardSnap(): boolean {
    const hardSnap = this.hardSnap;
    this.hardSnap = false;
    return hardSnap;
  }

  reset(hardSnap = false): void {
    this.offset = ZERO_CORRECTION;
    this.hardSnap = hardSnap;
    this.lastError = 0;
  }
}
