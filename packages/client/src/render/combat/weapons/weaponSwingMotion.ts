/** Per-weapon melee hand kinematics and body lunge curves across Sword, Axe, Pickaxe, Torch, and extensible weapons. */
import { getItemDef } from "@dc2d/content";
import { getWeaponStepSpec, resolveWeaponArchetype, type AttackMotionKind, type WeaponStepSpec } from "@dc2d/engine";

export interface WeaponSwingPlacement {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly behindBody: boolean;
}

export interface WeaponSwingPoseInput {
  readonly ax: number;
  readonly ay: number;
  readonly scale: number;
  readonly progress: number;
  readonly comboStep: number;
  readonly heldItem?: string | null | undefined;
  readonly uprightSprite?: boolean | undefined;
}

interface ArcMotionParams {
  readonly sweep: number;
  readonly baseReach: number;
  readonly extReach: number;
  readonly punch: number;
  readonly pullbackEnd: number;
}

const ARC_PARAMS: Readonly<Record<"slash" | "backhand" | "chop" | "cleave", ArcMotionParams>> = {
  slash: { sweep: 1.02, baseReach: 5.6, extReach: 2.6, punch: 0.08, pullbackEnd: 0.14 },
  backhand: { sweep: 1.06, baseReach: 5.8, extReach: 2.8, punch: 0.08, pullbackEnd: 0.14 },
  chop: { sweep: 1.32, baseReach: 6.2, extReach: 3.4, punch: 0.20, pullbackEnd: 0.26 },
  cleave: { sweep: 1.48, baseReach: 6.8, extReach: 3.6, punch: 0.18, pullbackEnd: 0.28 },
};

function arcEase(p: number, pullbackEnd: number): number {
  if (p < pullbackEnd) return -0.18 * (p / pullbackEnd);
  const midEnd = 0.72;
  if (p < midEnd) {
    const t = (p - pullbackEnd) / (midEnd - pullbackEnd);
    const inv = 1 - t;
    return -0.18 + 1.10 * (1 - inv * inv * inv);
  }
  return 0.92 + ((p - midEnd) / (1 - midEnd)) * 0.08;
}

function thrustEnvelope(p: number): number {
  if (p < 0.22) return -0.38 * (p / 0.22);
  if (p < 0.58) {
    const inv = 1 - (p - 0.22) / 0.36;
    return -0.38 + 1.38 * (1 - inv * inv * inv);
  }
  return 1.0 - 0.72 * ((p - 0.58) / 0.42);
}

function resolveStep(heldItem: string | null | undefined, comboStep: number): WeaponStepSpec {
  const def = heldItem ? getItemDef(heldItem) : undefined;
  const archetype = resolveWeaponArchetype(heldItem, def?.weaponArchetype);
  return getWeaponStepSpec(archetype, comboStep || 1);
}

function computeArcSwingPose(input: WeaponSwingPoseInput, spec: WeaponStepSpec, p: number): WeaponSwingPlacement {
  const key = (spec.motion === "chop" || spec.motion === "cleave" || spec.motion === "backhand" ? spec.motion : "slash");
  const arc = ARC_PARAMS[key];
  const aimAng = Math.atan2(input.ay, input.ax);
  const eased = arcEase(p, arc.pullbackEnd);
  const bladeAng = aimAng + spec.sweepDir * (-arc.sweep + 2 * arc.sweep * eased);
  const reach = arc.baseReach + Math.sin(p * Math.PI) * arc.extReach;
  const sScale = input.scale * (1 + Math.sin(p * Math.PI) * arc.punch);
  return {
    x: Math.cos(bladeAng) * reach,
    y: -9.2 + Math.sin(bladeAng) * reach * 0.78,
    rotation: input.uprightSprite ? bladeAng + Math.PI * 0.5 : bladeAng,
    scaleX: sScale * (input.uprightSprite ? spec.sweepDir : 1),
    scaleY: sScale * (input.uprightSprite ? 1 : spec.sweepDir),
    behindBody: Math.sin(bladeAng) < -0.42,
  };
}

function computeThrustSwingPose(input: WeaponSwingPoseInput, motion: AttackMotionKind, p: number): WeaponSwingPlacement {
  const isLunge = motion === "lunge";
  const env = thrustEnvelope(p);
  const aimAng = Math.atan2(input.ay, input.ax);
  const reach = (isLunge ? 6.2 : 5.4) + env * (isLunge ? 5.0 : 4.2);
  const flipSign = input.ax < -0.05 ? -1 : 1;
  const sScale = input.scale * (1 + Math.max(0, env) * 0.14);
  return {
    x: Math.cos(aimAng) * reach,
    y: -9.2 + Math.sin(aimAng) * reach * 0.78,
    rotation: input.uprightSprite ? aimAng + Math.PI * 0.5 : aimAng,
    scaleX: sScale,
    scaleY: sScale * flipSign,
    behindBody: input.ay < -0.42,
  };
}

function overheadTrajectory(p: number): { readonly liftY: number; readonly forward: number; readonly cock: number } {
  if (p < 0.34) {
    const u = p / 0.34;
    return { liftY: -9.2 - u * 9.5, forward: 2.5 - u * 2.5, cock: -(0.65 + u * 0.85) };
  }
  if (p < 0.68) {
    const t = (p - 0.34) / 0.34;
    const slam = t * t;
    return { liftY: -18.7 + slam * 16.5, forward: slam * 8.2, cock: -1.5 * (1 - slam) + 0.25 * slam };
  }
  const r = (p - 0.68) / 0.32;
  return { liftY: -2.2 - r * 5.0, forward: 8.2 - r * 3.0, cock: 0.25 * (1 - r) };
}

function computeOverheadSlamPose(input: WeaponSwingPoseInput, p: number): WeaponSwingPlacement {
  const { liftY, forward, cock } = overheadTrajectory(p);
  const flipSign = input.ax < -0.05 ? -1 : 1;
  const aimAng = Math.atan2(input.ay, input.ax);
  const sScale = input.scale * (1 + Math.sin(p * Math.PI) * 0.14);
  return {
    x: input.ax * forward,
    y: liftY + input.ay * forward * 0.55,
    rotation: aimAng + flipSign * cock,
    scaleX: sScale,
    scaleY: sScale * flipSign,
    behindBody: p < 0.34 && input.ay < -0.2,
  };
}

export function computeWeaponSwingPose(input: WeaponSwingPoseInput): WeaponSwingPlacement {
  const p = Math.min(1, Math.max(0, input.progress));
  const spec = resolveStep(input.heldItem, input.comboStep);
  if (spec.motion === "overheadSlam") return computeOverheadSlamPose(input, p);
  if (spec.motion === "lunge" || spec.motion === "thrust") return computeThrustSwingPose(input, spec.motion, p);
  return computeArcSwingPose(input, spec, p);
}

export function computeWeaponSwingLunge(opts: {
  readonly ax: number; readonly ay: number; readonly swingProgress: number;
  readonly comboStep: number; readonly heldItem?: string | null | undefined;
}): { readonly x: number; readonly y: number; readonly rot: number } {
  const p = Math.min(1, Math.max(0, opts.swingProgress));
  if (p <= 0) return { x: 0, y: 0, rot: 0 };
  const spec = resolveStep(opts.heldItem, opts.comboStep);
  const forwardEnv = spec.motion === "lunge" || spec.motion === "thrust" ? Math.max(-0.25, thrustEnvelope(p)) : Math.sin(p * Math.PI);
  const slamYOffset = spec.motion === "overheadSlam" ? (p < 0.34 ? -1.1 : Math.sin(((p - 0.34) / 0.66) * Math.PI) * 1.4) : 0;
  return {
    x: opts.ax * spec.lungePx * forwardEnv,
    y: opts.ay * spec.lungePx * forwardEnv * 0.7 + slamYOffset,
    rot: (p - 0.5) * spec.torsoLeanRad * spec.sweepDir,
  };
}
