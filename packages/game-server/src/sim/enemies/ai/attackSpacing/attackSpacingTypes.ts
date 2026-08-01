import { type EnemyDecision, type Entity } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../../state/state.js";

export type AttackMode = "melee" | "ranged";

export interface AttackSpacingInput {
  readonly sim: SimState;
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, Entity | undefined>;
  readonly decisions: ReadonlyMap<string, EnemyDecision>;
}

export interface AttackRequest {
  readonly enemy: EnemySlot;
  readonly decision: EnemyDecision;
  readonly target: Entity;
}

export interface CandidatePoint {
  readonly x: number;
  readonly y: number;
}

export interface MeleeSlotCandidate extends CandidatePoint {
  readonly z: number;
  readonly canShare: boolean;
}

export interface MeleeSlotOccupant {
  readonly enemy: EnemySlot;
  readonly slot: MeleeSlotCandidate;
}

export interface SlotSelectionInput {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly target: Entity;
  readonly targetId: string;
  readonly attackRange: number;
  readonly occupied: readonly MeleeSlotOccupant[];
  readonly preserveImmediate?: boolean;
  readonly decision?: EnemyDecision;
}

export const ATTACK_SLOT_REACHED_EPSILON = 0.1;
export const ATTACK_KIND = {
  meleeSlot: "melee-slot",
  rangedAim: "ranged-aim",
} as const;

export const RANGED_SPREADS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 0, y: 0 },
  { x: 0.44, y: 0 },
  { x: -0.44, y: 0 },
  { x: 0, y: 0.44 },
  { x: 0, y: -0.44 },
  { x: 0.3, y: 0.3 },
  { x: -0.3, y: 0.3 },
  { x: 0.3, y: -0.3 },
  { x: -0.3, y: -0.3 },
];

export const RANGED_STANDOFF_DIRECTIONS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
];
