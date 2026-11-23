/** Pure dominant-hand weapon carry, 360-degree bow aim, and off-hand torch/lantern calculator. */
import { MELEE_SWING_TUNING } from "../combat/combatVisualTuning.js";
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
  readonly hasShield?: boolean;
  readonly blocking?: boolean;
  readonly swingProgress?: number;
  readonly comboStep?: number;
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
  readonly kind: "none" | "handLantern" | "hipLantern";
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly behindBody: boolean;
}

export interface ShieldPlacement {
  readonly equipped: boolean;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly behindBody: boolean;
}

export interface HeldLayout {
  readonly main: MainHandPlacement;
  readonly offhand: OffhandPlacement;
  readonly shield: ShieldPlacement;
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
  west: { x: -4.4, y: -7.4, rot: 0.92, rotSign: -1, scaleSign: -1, behind: true },
};

const UPRIGHT_SPECS: Readonly<Record<CardinalFacing, { readonly x: number; readonly y: number; readonly rot: number; readonly scaleSign: number; readonly behind: boolean }>> = {
  south: { x: -5.0, y: -7.4, rot: -0.14, scaleSign: -1, behind: false },
  north: { x: 5.0, y: -7.4, rot: 0.14, scaleSign: 1, behind: true },
  east: { x: 5.2, y: -7.6, rot: 0.14, scaleSign: 1, behind: false },
  west: { x: -5.2, y: -7.6, rot: -0.14, scaleSign: -1, behind: true },
};

const HAND_LANTERN_SPECS: Readonly<Record<CardinalFacing, { readonly x: number; readonly y: number; readonly rot: number; readonly behind: boolean }>> = {
  south: { x: 4.8, y: -7.2, rot: 0.08, behind: false }, north: { x: -4.8, y: -7.2, rot: -0.08, behind: true },
  east: { x: 4.8, y: -7.4, rot: 0.14, behind: true }, west: { x: -3.4, y: -7.0, rot: -0.14, behind: false },
};

const LANTERN_SPECS: Readonly<Record<CardinalFacing, { readonly x: number; readonly behind: boolean }>> = {
  south: { x: 4.2, behind: false }, north: { x: -4.2, behind: true },
  east: { x: 1.4, behind: true }, west: { x: -1.4, behind: false },
};

type PoseSpec = { readonly x: number; readonly y: number; readonly rot: number; readonly scaleSign: number; readonly behind: boolean };

const SHIELD_REST_SPECS: Readonly<Record<CardinalFacing, PoseSpec>> = {
  south: { x: 4.9, y: -6.8, rot: 0.08, scaleSign: 1, behind: false }, north: { x: -4.9, y: -6.8, rot: -0.08, scaleSign: -1, behind: true },
  east: { x: 4.5, y: -7.0, rot: 0.12, scaleSign: 1, behind: true }, west: { x: -3.2, y: -7.0, rot: -0.12, scaleSign: -1, behind: false },
};

const SHIELD_BLOCK_SPECS: Readonly<Record<CardinalFacing, PoseSpec>> = {
  south: { x: 1.6, y: -8.2, rot: -0.04, scaleSign: 1, behind: false }, north: { x: -2.0, y: -8.2, rot: 0.04, scaleSign: -1, behind: true },
  east: { x: 5.8, y: -8.5, rot: -0.08, scaleSign: 1, behind: false }, west: { x: -5.4, y: -8.5, rot: 0.08, scaleSign: -1, behind: false },
};

function resolveDirContext(dx: number, dy: number): ResolvedDirContext {
  const mag = Math.hypot(dx, dy);
  const ax = mag < 0.01 ? 0 : dx / mag;
  const ay = mag < 0.01 ? 1 : dy / mag;
  const { dir, flipX } = resolveFacingDir(ax, ay);
  const cardinal: CardinalFacing = dir === "side" ? (flipX ? "west" : "east") : dir;
  return { ax, ay, cardinal };
}

function swingEase(p: number): number {
  if (p < 0.14) return -0.12 * (p / 0.14);
  if (p < 0.72) {
    const t = (p - 0.14) / 0.58;
    const inv = 1 - t;
    return -0.12 + 1.04 * (1 - inv * inv * inv);
  }
  return 0.92 + ((p - 0.72) / 0.28) * 0.08;
}

export function computeSwingLunge(opts: {
  readonly aimX: number; readonly aimY: number; readonly swingProgress: number; readonly comboStep: number;
}): { readonly x: number; readonly y: number; readonly rot: number } {
  const p = Math.min(1, Math.max(0, opts.swingProgress));
  if (p <= 0) return { x: 0, y: 0, rot: 0 };
  const ctx = resolveDirContext(opts.aimX, opts.aimY);
  const lunge = Math.sin(p * Math.PI) * (opts.comboStep === 3 ? MELEE_SWING_TUNING.lungeFinisherPx : MELEE_SWING_TUNING.lungeNormalPx);
  const sign = opts.comboStep === 2 ? -1 : 1;
  return { x: ctx.ax * lunge, y: ctx.ay * lunge * 0.7, rot: (p - 0.5) * MELEE_SWING_TUNING.torsoLeanRad * sign };
}

export function resolveAimCardinal(ax: number, ay: number, fallback: CardinalFacing): CardinalFacing {
  if (Math.hypot(ax, ay) < 0.01) return fallback;
  const { dir, flipX } = resolveFacingDir(ax, ay);
  return dir === "side" ? (flipX ? "west" : "east") : dir;
}

function resolveActorTint(hit: number, staggered: boolean): number {
  if (staggered) return 0xfef08a;
  if (hit > 0.16) return 0xffa8a8;
  return hit > 0 ? 0xfca5a5 : 0xffffff;
}

function resolveDodgeRot(dodging: boolean, facingX: number, is3d?: boolean): number {
  return dodging && !is3d ? Math.sign(facingX || 1) * 0.16 : 0;
}

function resolveActorAlpha(dodging: boolean, invulnTimer: number | undefined, timeSec: number | undefined): number {
  if (dodging) return 0.62;
  if ((invulnTimer ?? 0) > 0) return Math.floor((timeSec ?? 0) * 20) % 2 === 0 ? 0.48 : 0.96;
  return 1;
}

export function computeActorCombatFx(opts: {
  readonly aimX: number; readonly aimY: number; readonly facingX: number;
  readonly swingProgress: number; readonly comboStep: number;
  readonly dodging: boolean; readonly staggered: boolean;
  readonly invulnTimer?: number | undefined;
  readonly hitTimer?: number | undefined; readonly downed?: boolean | undefined; readonly timeSec?: number | undefined;
  readonly is3d?: boolean | undefined;
}): { readonly x: number; readonly y: number; readonly rot: number; readonly alpha: number; readonly tint: number } {
  if (opts.downed) {
    return opts.is3d ? { x: 0, y: 0, rot: 0, alpha: 0.9, tint: 0x94a3b8 } : { x: 0, y: 4, rot: Math.PI * 0.48, alpha: 0.78, tint: 0x94a3b8 };
  }
  const lunge = computeSwingLunge(opts);
  const hit = opts.hitTimer ?? 0;
  const w = hit > 0 ? Math.sin((opts.timeSec ?? 0) * 58) * 1.4 : 0;
  return { x: lunge.x + w, y: lunge.y, rot: lunge.rot + resolveDodgeRot(opts.dodging, opts.facingX, opts.is3d), alpha: resolveActorAlpha(opts.dodging, opts.invulnTimer, opts.timeSec), tint: resolveActorTint(hit, opts.staggered) };
}

function swingMeleePose(opts: {
  readonly ctx: ResolvedDirContext;
  readonly spec: (typeof MELEE_SPECS)[CardinalFacing];
  readonly scale: number;
  readonly walkBob: number;
  readonly progress: number;
  readonly comboStep: number;
  readonly uprightSprite?: boolean;
}): MainHandPlacement {
  const { ctx, scale, progress, comboStep, uprightSprite } = opts;
  const p = Math.min(1, Math.max(0, progress));
  const arc = MELEE_SWING_TUNING.combos[comboStep] ?? MELEE_SWING_TUNING.combos[1]!;
  const aimAng = Math.atan2(ctx.ay, ctx.ax);
  const eased = swingEase(p);
  const bladeAng = aimAng + arc.dir * (-arc.sweep + 2 * arc.sweep * eased);
  const reach = arc.baseReach + Math.sin(p * Math.PI) * arc.extReach;
  const punch = 1 + Math.sin(p * Math.PI) * arc.punch;
  const sScale = scale * punch;
  return {
    x: Math.cos(bladeAng) * reach,
    y: -9.2 + Math.sin(bladeAng) * reach * 0.78,
    rotation: uprightSprite ? bladeAng + Math.PI * 0.5 : bladeAng,
    scaleX: sScale * (uprightSprite ? arc.dir : 1),
    scaleY: sScale * (uprightSprite ? 1 : arc.dir),
    behindBody: Math.sin(bladeAng) < -0.42,
  };
}

function computeAim360Placement(input: {
  readonly ctx: ResolvedDirContext;
  readonly twoHanded: boolean;
  readonly scale: number;
  readonly walkBob: number;
}): MainHandPlacement {
  const { ctx, twoHanded, scale, walkBob } = input;
  const reach = twoHanded ? 5.4 : 5.2;
  const baseY = twoHanded ? -9.8 : -9.5;
  return {
    x: ctx.ax * reach,
    y: baseY + walkBob + ctx.ay * (twoHanded ? 3.6 : 3.8),
    rotation: Math.atan2(ctx.ay, ctx.ax),
    scaleX: scale,
    scaleY: ctx.ax < -0.05 ? -scale : scale,
    behindBody: ctx.ay < -0.35,
  };
}

function computeMainPlacement(input: {
  readonly ctx: ResolvedDirContext; readonly twoHanded: boolean; readonly aimMode: "aim360" | "meleeCarry" | "upright";
  readonly scale: number; readonly walkBob: number; readonly sway: number; readonly swingProgress: number; readonly comboStep: number;
}): MainHandPlacement {
  if (input.aimMode === "meleeCarry") {
    const s = MELEE_SPECS[input.ctx.cardinal];
    return input.swingProgress > 0
      ? swingMeleePose({ ctx: input.ctx, spec: s, scale: input.scale, walkBob: input.walkBob, progress: input.swingProgress, comboStep: input.comboStep })
      : { x: s.x, y: s.y + input.walkBob, rotation: s.rot + s.rotSign * input.sway, scaleX: s.scaleSign * input.scale, scaleY: input.scale, behindBody: s.behind };
  }
  if (input.aimMode === "upright") {
    const s = UPRIGHT_SPECS[input.ctx.cardinal];
    return input.swingProgress > 0
      ? swingMeleePose({ ctx: input.ctx, spec: MELEE_SPECS[input.ctx.cardinal], scale: input.scale, walkBob: input.walkBob, progress: input.swingProgress, comboStep: input.comboStep, uprightSprite: true })
      : { x: s.x, y: s.y + input.walkBob, rotation: s.rot, scaleX: s.scaleSign * input.scale, scaleY: input.scale, behindBody: s.behind };
  }
  return computeAim360Placement(input);
}

function computeOffhandPlacement(input: {
  readonly ctx: ResolvedDirContext; readonly heldItem: string | null; readonly torchLit: boolean;
  readonly twoHanded: boolean; readonly hasShield: boolean; readonly walkBob: number; readonly sway: number;
}): OffhandPlacement {
  if (!input.torchLit || input.heldItem === "torch") return { kind: "none", x: 0, y: 0, rotation: 0, behindBody: false };
  if (input.twoHanded || input.hasShield) {
    const l = LANTERN_SPECS[input.ctx.cardinal];
    return { kind: "hipLantern", x: l.x, y: -6.4 + input.walkBob * 0.4, rotation: 0, behindBody: l.behind };
  }
  const h = HAND_LANTERN_SPECS[input.ctx.cardinal];
  return { kind: "handLantern", x: h.x, y: h.y - input.walkBob * 0.5, rotation: h.rot + input.sway * 0.6, behindBody: h.behind };
}

function computeShieldPlacement(input: {
  readonly ctx: ResolvedDirContext; readonly hasShield: boolean; readonly twoHanded: boolean; readonly blocking: boolean; readonly walkBob: number;
}): ShieldPlacement {
  if (!input.hasShield || input.twoHanded) {
    return { equipped: false, x: 0, y: 0, rotation: 0, scaleX: CHARACTER_WORLD_SCALE, behindBody: false };
  }
  const s = (input.blocking ? SHIELD_BLOCK_SPECS : SHIELD_REST_SPECS)[input.ctx.cardinal];
  return { equipped: true, x: s.x, y: s.y + input.walkBob * 0.45, rotation: s.rot, scaleX: CHARACTER_WORLD_SCALE * s.scaleSign, behindBody: s.behind };
}

export function computeHeldLayout(input: HeldPlacementInput): HeldLayout {
  const ctx = resolveDirContext(input.aimX, input.aimY);
  const walkBob = input.moving ? Math.sin(input.timeSec * 14) * 0.85 : Math.sin(input.timeSec * 4) * 0.3;
  const sway = input.moving ? Math.sin(input.timeSec * 11) * 0.12 : Math.sin(input.timeSec * 3.5) * 0.04;
  const scale = input.itemScale ?? CHARACTER_WORLD_SCALE;
  const hasShield = Boolean(input.hasShield);
  return {
    main: computeMainPlacement({
      ctx, twoHanded: input.twoHanded, aimMode: input.aimMode, scale, walkBob, sway,
      swingProgress: input.swingProgress ?? 0, comboStep: input.comboStep ?? 0,
    }),
    offhand: computeOffhandPlacement({
      ctx, heldItem: input.heldItem, torchLit: input.torchLit, twoHanded: input.twoHanded, hasShield, walkBob, sway,
    }),
    shield: computeShieldPlacement({
      ctx, hasShield, twoHanded: input.twoHanded, blocking: Boolean(input.blocking), walkBob,
    }),
  };
}
