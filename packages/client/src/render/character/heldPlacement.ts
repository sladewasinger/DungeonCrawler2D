/** Pure dominant-hand weapon carry, 360-degree bow aim, and off-hand torch/lantern calculator. */
import { CHARACTER_WORLD_SCALE, resolveFacingDir } from "./characterTypes.js";

export type CardinalFacing = "south" | "north" | "east" | "west";

export interface HeldPlacementInput {
  readonly aimX: number;
  readonly aimY: number;
  readonly heldItem: string | null;
  readonly torchLit: boolean;
  readonly twoHanded: boolean;
  readonly aimMode: "aim360" | "meleeCarry" | "upright";
  readonly itemScale?: number;
  readonly timeSec: number;
  readonly moving: boolean;
}

export interface MainHandPlacement {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly behindBody: boolean;
}

export interface OffhandPlacement {
  readonly kind: "none" | "torch" | "lantern";
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly behindBody: boolean;
}

export interface HeldLayout {
  readonly main: MainHandPlacement;
  readonly offhand: OffhandPlacement;
}

interface ResolvedDirContext {
  readonly ax: number;
  readonly ay: number;
  readonly cardinal: CardinalFacing;
}

const MELEE_SPECS: Readonly<Record<CardinalFacing, { readonly x: number; readonly y: number; readonly rot: number; readonly rotSign: number; readonly scaleSign: number; readonly behind: boolean }>> = {
  south: { x: -4.8, y: -7.2, rot: 1.02, rotSign: -1, scaleSign: -1, behind: false },
  north: { x: 4.8, y: -7.2, rot: -1.02, rotSign: 1, scaleSign: 1, behind: true },
  east: { x: 2.0, y: -7.0, rot: -0.88, rotSign: 1, scaleSign: 1, behind: false },
  west: { x: -5.4, y: -7.4, rot: 0.92, rotSign: -1, scaleSign: -1, behind: true },
};

const UPRIGHT_SPECS: Readonly<Record<CardinalFacing, { readonly x: number; readonly y: number; readonly rot: number; readonly scaleSign: number; readonly behind: boolean }>> = {
  south: { x: -5.0, y: -7.4, rot: -0.14, scaleSign: -1, behind: false },
  north: { x: 5.0, y: -7.4, rot: 0.14, scaleSign: 1, behind: true },
  east: { x: 5.2, y: -7.6, rot: 0.14, scaleSign: 1, behind: false },
  west: { x: -5.2, y: -7.6, rot: -0.14, scaleSign: -1, behind: true },
};

const TORCH_OFFHAND_SPECS: Readonly<Record<CardinalFacing, { readonly x: number; readonly y: number; readonly rot: number; readonly behind: boolean }>> = {
  south: { x: 4.8, y: -7.2, rot: 0.14, behind: false },
  north: { x: -4.8, y: -7.2, rot: -0.14, behind: true },
  east: { x: 7.4, y: -6.8, rot: 0.28, behind: true },
  west: { x: -4.2, y: -5.8, rot: -0.24, behind: false },
};

const LANTERN_SPECS: Readonly<Record<CardinalFacing, { readonly x: number; readonly behind: boolean }>> = {
  south: { x: 4.2, behind: false },
  north: { x: -4.2, behind: true },
  east: { x: 1.4, behind: true },
  west: { x: -1.4, behind: false },
};

function resolveDirContext(dx: number, dy: number): ResolvedDirContext {
  const mag = Math.hypot(dx, dy);
  const ax = mag < 0.01 ? 0 : dx / mag;
  const ay = mag < 0.01 ? 1 : dy / mag;
  const { dir, flipX } = resolveFacingDir(ax, ay);
  const cardinal: CardinalFacing = dir === "side" ? (flipX ? "west" : "east") : dir;
  return { ax, ay, cardinal };
}

function computeMainPlacement(input: {
  readonly ctx: ResolvedDirContext;
  readonly twoHanded: boolean;
  readonly aimMode: "aim360" | "meleeCarry" | "upright";
  readonly scale: number;
  readonly walkBob: number;
  readonly sway: number;
}): MainHandPlacement {
  const { ctx, twoHanded, aimMode, scale, walkBob, sway } = input;
  if (aimMode === "meleeCarry") {
    const s = MELEE_SPECS[ctx.cardinal];
    return { x: s.x, y: s.y + walkBob, rotation: s.rot + s.rotSign * sway, scaleX: s.scaleSign * scale, scaleY: scale, behindBody: s.behind };
  }
  if (aimMode === "upright") {
    const s = UPRIGHT_SPECS[ctx.cardinal];
    return { x: s.x, y: s.y + walkBob, rotation: s.rot, scaleX: s.scaleSign * scale, scaleY: scale, behindBody: s.behind };
  }
  const reach = twoHanded ? 6.0 : 5.2;
  return {
    x: ctx.ax * reach,
    y: -9.5 + walkBob + ctx.ay * 3.8,
    rotation: Math.atan2(ctx.ay, ctx.ax),
    scaleX: scale,
    scaleY: ctx.ax < -0.05 ? -scale : scale,
    behindBody: ctx.ay < -0.35,
  };
}

function computeOffhandPlacement(input: {
  readonly ctx: ResolvedDirContext;
  readonly heldItem: string | null;
  readonly torchLit: boolean;
  readonly twoHanded: boolean;
  readonly walkBob: number;
}): OffhandPlacement {
  const { ctx, heldItem, torchLit, twoHanded, walkBob } = input;
  if (!torchLit || heldItem === "torch") {
    return { kind: "none", x: 0, y: 0, rotation: 0, behindBody: false };
  }
  if (twoHanded) {
    const l = LANTERN_SPECS[ctx.cardinal];
    return { kind: "lantern", x: l.x, y: -6.4 + walkBob * 0.4, rotation: 0, behindBody: l.behind };
  }
  const t = TORCH_OFFHAND_SPECS[ctx.cardinal];
  return { kind: "torch", x: t.x, y: t.y - walkBob * 0.5, rotation: t.rot, behindBody: t.behind };
}

export function computeHeldLayout(input: HeldPlacementInput): HeldLayout {
  const ctx = resolveDirContext(input.aimX, input.aimY);
  const walkBob = input.moving ? Math.sin(input.timeSec * 14) * 0.85 : Math.sin(input.timeSec * 4) * 0.3;
  const sway = input.moving ? Math.sin(input.timeSec * 11) * 0.12 : Math.sin(input.timeSec * 3.5) * 0.04;
  const scale = input.itemScale ?? CHARACTER_WORLD_SCALE;
  return {
    main: computeMainPlacement({ ctx, twoHanded: input.twoHanded, aimMode: input.aimMode, scale, walkBob, sway }),
    offhand: computeOffhandPlacement({ ctx, heldItem: input.heldItem, torchLit: input.torchLit, twoHanded: input.twoHanded, walkBob }),
  };
}
