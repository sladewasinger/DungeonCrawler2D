import type { HealthFeedback } from "../../ui/presentation/healthFeedback.js";
import type { AttackProfile } from "@dc2d/engine";

export interface MotionVfxInput {
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
  readonly air: boolean;
  readonly faceX: number;
  readonly nowMs: number;
}

export interface OutOfBreathVfxInput {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly faceX: number;
  readonly exhausted: boolean;
  readonly nowMs: number;
}

export interface DamageNumberVfxInput {
  readonly x: number;
  readonly y: number;
  readonly feedback: HealthFeedback;
  readonly nowMs: number;
}

export interface MeleeVfxInput {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angleRad: number;
  readonly depth: number;
  readonly tilePx: number;
  readonly nowMs: number;
  readonly profile: AttackProfile;
}

/** Live position-only update for an already spawned swing's locked geometry. */
export interface MeleeVfxPositionInput {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface WallBumpVfxInput {
  readonly x: number;
  readonly y: number;
  readonly direction: { x: number; y: number };
  readonly nowMs: number;
}
