/** Sandbox lineup definitions, pose presets, and frozen directional preview helpers. */
import type { AiState, EntityKind, GoreSubstance, WorldEntitySnapshot } from "@dc2d/engine";

export type SandboxPose = "idle" | "walk" | "run" | "windup" | "corpse";
export type SandboxFacing = "auto" | "south" | "east" | "west" | "north";

export interface LineupSpec {
  readonly kind: EntityKind;
  readonly label: string;
  readonly maxHp: number;
  readonly substance: GoreSubstance;
}

export const SANDBOX_LINEUP_Y = 22.4;
export const SANDBOX_LINEUP_X0 = 4.5;
export const SANDBOX_LINEUP_DX = 3.1;

export const LINEUP_SPECS: readonly LineupSpec[] = [
  { kind: "wolf", label: "Wolf", maxHp: 65, substance: "blood" },
  { kind: "bear", label: "Bear", maxHp: 140, substance: "blood" },
  { kind: "spider", label: "Spider", maxHp: 55, substance: "ichor" },
  { kind: "boar", label: "Boar", maxHp: 85, substance: "blood" },
  { kind: "slime", label: "Slime", maxHp: 45, substance: "slime" },
  { kind: "goblin", label: "Goblin", maxHp: 60, substance: "blood" },
  { kind: "orc", label: "Orc", maxHp: 120, substance: "blood" },
  { kind: "skeleton", label: "Skeleton", maxHp: 75, substance: "bone" },
  { kind: "golem", label: "Golem", maxHp: 220, substance: "bone" },
  { kind: "dummy", label: "Dummy", maxHp: 100, substance: "straw" },
  { kind: "slime-dummy", label: "Slime Dummy", maxHp: 100, substance: "slime" },
  { kind: "spar-dummy", label: "Spar Dummy", maxHp: 120, substance: "straw" },
];

const FACING_MAP: Readonly<Record<Exclude<SandboxFacing, "auto">, { readonly facingX: number; readonly facingY: number }>> = {
  east: { facingX: 1, facingY: 0 },
  west: { facingX: -1, facingY: 0 },
  north: { facingX: 0, facingY: -1 },
  south: { facingX: 0, facingY: 1 },
};

const AUTO_DIRS: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

export function isDummyKind(kind: EntityKind): boolean {
  return kind === "dummy" || kind === "slime-dummy" || kind === "spar-dummy";
}

function resolveFrozenFacing(facing: SandboxFacing, timeSec: number): { readonly facingX: number; readonly facingY: number } {
  if (facing !== "auto") return FACING_MAP[facing];
  const pair = AUTO_DIRS[Math.floor(timeSec / 1.8) % AUTO_DIRS.length]!;
  return { facingX: pair[0], facingY: pair[1] };
}

function resolveFrozenWindup(kind: EntityKind, timeSec: number): {
  readonly aiState: AiState;
  readonly telegraphProgress: number;
} {
  const period = kind === "boar" ? 3.2 : 2.0;
  const cyc = timeSec % period;
  const telegraphProgress = cyc < 0.55 ? Math.max(0.01, cyc / 0.55) : 0;
  if (kind === "boar") return { aiState: cyc < 2.05 ? "charge" : "idle", telegraphProgress };
  return { aiState: "idle", telegraphProgress };
}

function resolveFrozenState(kind: EntityKind, pose: SandboxPose, timeSec: number): {
  readonly aiState: AiState;
  readonly telegraphProgress: number;
} {
  if (pose === "windup") return resolveFrozenWindup(kind, timeSec);
  if (pose === "walk") return { aiState: "patrol", telegraphProgress: 0 };
  if (pose === "run") return { aiState: "chase", telegraphProgress: 0 };
  return { aiState: "idle", telegraphProgress: 0 };
}

export function applyFrozenPose(
  actor: { readonly homeX: number; readonly homeY: number; snap: WorldEntitySnapshot },
  opts: { readonly pose: SandboxPose; readonly facing: SandboxFacing; readonly timeSec: number },
): void {
  const s = actor.snap;
  if (opts.pose === "corpse") {
    actor.snap = { ...s, x: actor.homeX, y: actor.homeY, hp: 0, corpse: true, aiState: "dead", telegraphProgress: 0 };
    return;
  }
  const { facingX, facingY } = resolveFrozenFacing(opts.facing, opts.timeSec);
  const { aiState, telegraphProgress } = resolveFrozenState(s.kind, opts.pose, opts.timeSec);
  actor.snap = {
    ...s, x: actor.homeX, y: actor.homeY, hp: s.maxHp, corpse: false,
    facingX, facingY, aiState, telegraphProgress,
  };
}
