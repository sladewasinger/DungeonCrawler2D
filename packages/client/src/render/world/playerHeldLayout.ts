/** Pure 3D/2D held-weapon, bow-aim, offhand, and shield placement layout helpers. */
import { SKIN_PALETTES } from "@dc2d/content";
import { gaitFrameIndex, type PlayerSnapshot } from "@dc2d/engine";
import { CHARACTER_WORLD_SCALE, resolveFacingDir8 } from "../character/characterSprites.js";
import type { CharacterPose, FacingDir } from "../character/characterTypes.js";
import {
  computeHeldLayout, type HeldLayout, type MainHandPlacement, type OffhandPlacement, type ShieldPlacement,
} from "../character/heldPlacement.js";
import type { HeldWeaponVisual } from "../character/heldWeapons.js";
import { sampleHandSockets, type FrameHandSockets } from "../character/playerAssets.js";
import { getTunedLanternArm, getTunedSwordArm } from "../poseTuning/poseTuningHelpers.js";

const FALLBACK_VISUAL = { twoHanded: false, aimMode: "upright" as const, spriteScale: CHARACTER_WORLD_SCALE };
const HELD_Y_OFFSET_3D = -1.8;
const COS_38 = 0.78801;
const SIN_38 = 0.61566;
const UPRIGHT_TILT = [-0.14, -0.06, 0.14, 0.22, 0.14, -0.22, -0.14, 0.06] as const;
const DIR8_MIRRORED_IDX: Readonly<Record<FacingDir, readonly [number, number]>> = {
  south: [0, 0], se: [1, 7], side: [2, 6], ne: [3, 5], north: [4, 4],
};
const BOW_FALLBACK_HANDS: readonly { readonly x: number; readonly y: number }[] = [
  { x: 4.5, y: -11.5 }, { x: 5.5, y: -12.0 }, { x: 6.8, y: -12.8 }, { x: 5.5, y: -13.8 },
  { x: -4.5, y: -13.5 }, { x: -5.5, y: -13.8 }, { x: -6.8, y: -12.8 }, { x: -5.5, y: -12.0 },
];

export interface PoseLocator {
  readonly dir: FacingDir; readonly flipX: boolean; readonly clip: string;
  readonly frameIdx: number; readonly pose: CharacterPose;
}

export function skinTint(skinId: string): number {
  const pal = SKIN_PALETTES[skinId] ?? SKIN_PALETTES.warm;
  return pal ? Number.parseInt(pal.base.slice(1), 16) : 0xecc096;
}

export function resolveDir8Idx(dir: FacingDir, flipX: boolean): number {
  return DIR8_MIRRORED_IDX[dir][flipX ? 1 : 0];
}

function projectOrbit3d(yawIdx: number, local: { readonly lx: number; readonly ly: number; readonly lz: number }) {
  const rad = yawIdx * (Math.PI / 4);
  const cos = Math.cos(rad); const sin = Math.sin(rad);
  const rx = local.lx * cos - local.ly * sin;
  const ry = local.lx * sin + local.ly * cos;
  return { x: rx * 16, y: -(local.lz * COS_38 + ry * SIN_38) * 16 - 0.8, behind: ry > 0.01 };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function pickBowAnchor(opts: {
  readonly hands: FrameHandSockets | null; readonly flipX: boolean; readonly yawIdx: number; readonly bob: number;
}): { readonly x: number; readonly y: number } {
  if (opts.hands) {
    const h = opts.flipX ? opts.hands.right : opts.hands.left;
    return { x: h.x, y: h.y };
  }
  const fb = BOW_FALLBACK_HANDS[opts.yawIdx] ?? BOW_FALLBACK_HANDS[0]!;
  return { x: fb.x, y: fb.y + opts.bob * 0.4 };
}

function computeBowRotation(opts: { readonly yawIdx: number; readonly ax: number; readonly ay: number }): number {
  const { yawIdx, ax, ay } = opts;
  const rawPitch = Math.atan2(ay, Math.max(0.45, Math.abs(ax)));
  if (yawIdx === 0) return clamp(0.26 - ax * 0.28, 0.06, 0.44);
  if (yawIdx === 4) return clamp(0.26 + ax * 0.28, 0.06, 0.44);
  const signed = yawIdx >= 5 ? -rawPitch : rawPitch;
  return clamp(signed, -0.46, 0.46);
}

function compute3dBowAim(opts: {
  readonly aimX: number; readonly aimY: number; readonly yawIdx: number;
  readonly scale: number; readonly bob: number; readonly hands: FrameHandSockets | null; readonly flipX: boolean;
}): MainHandPlacement {
  const mag = Math.hypot(opts.aimX, opts.aimY);
  const ax = mag < 0.01 ? 0 : opts.aimX / mag;
  const ay = mag < 0.01 ? 1 : opts.aimY / mag;
  const pos = pickBowAnchor({ hands: opts.hands, flipX: opts.flipX, yawIdx: opts.yawIdx, bob: opts.bob });
  const mirror = opts.yawIdx >= 4 && opts.yawIdx <= 7;
  return {
    x: pos.x,
    y: pos.y,
    rotation: computeBowRotation({ yawIdx: opts.yawIdx, ax, ay }),
    scaleX: mirror ? -opts.scale : opts.scale,
    scaleY: opts.scale,
    behindBody: opts.yawIdx >= 3 && opts.yawIdx <= 5,
  };
}

function socketMainCarry(opts: {
  readonly right: NonNullable<FrameHandSockets["right"]>; readonly yawIdx: number; readonly body?: string | undefined;
  readonly aimMode: "meleeCarry" | "upright"; readonly scale: number;
}): MainHandPlacement {
  const { right, yawIdx, body, aimMode, scale } = opts;
  const c = getTunedSwordArm(yawIdx, body);
  if (aimMode === "upright") {
    const tilt = Math.cos(right.angle) * 0.22 + (UPRIGHT_TILT[yawIdx] ?? 0) * 0.45;
    return { x: right.x, y: right.y, rotation: tilt, scaleX: scale * c.scaleSign, scaleY: scale, behindBody: c.behind };
  }
  const tilt = (right.angle - Math.PI * 0.5) * 0.22;
  return { x: right.x, y: right.y, rotation: c.rot + tilt * c.rotSign, scaleX: c.scaleSign * scale, scaleY: scale, behindBody: c.behind };
}

function pickLegacyCarryPose(opts: {
  readonly yawIdx: number; readonly body?: string | undefined; readonly aimMode: "meleeCarry" | "upright";
  readonly scale: number; readonly bob: number; readonly sway: number;
}): MainHandPlacement {
  const c = getTunedSwordArm(opts.yawIdx, opts.body);
  if (opts.aimMode === "upright") {
    return { x: c.x, y: c.y + opts.bob, rotation: UPRIGHT_TILT[opts.yawIdx] ?? 0, scaleX: opts.scale * c.scaleSign, scaleY: opts.scale, behindBody: c.behind };
  }
  return { x: c.x, y: c.y + opts.bob, rotation: c.rot + c.rotSign * opts.sway, scaleX: c.scaleSign * opts.scale, scaleY: opts.scale, behindBody: c.behind };
}

function shouldUse3dBowAim(opts: { readonly aimMode: string; readonly activeClip?: string | undefined; readonly bowCharge?: number | undefined }): boolean {
  return opts.aimMode === "aim360" && (opts.activeClip === "bow" || (opts.bowCharge ?? 0) > 0.001);
}

function compute3dTwoHandBlock(opts: { readonly yawIdx: number; readonly scale: number; readonly bob: number }): MainHandPlacement {
  const sign = opts.yawIdx >= 4 && opts.yawIdx <= 7 ? -1 : 1;
  const p = projectOrbit3d(opts.yawIdx, { lx: 0.08, ly: -0.26, lz: 0.86 });
  return { x: p.x, y: p.y + opts.bob * 0.4, rotation: -0.58 * sign, scaleX: opts.scale * sign, scaleY: opts.scale, behindBody: p.behind };
}

const is3dTwoHandBlock = (b: boolean | undefined, twoHanded: boolean, mode: string): boolean => Boolean(b) && twoHanded && mode === "meleeCarry";

function compute3dMainCarry(opts: {
  readonly yawIdx: number; readonly flipX: boolean; readonly body?: string | undefined; readonly aimMode: "aim360" | "meleeCarry" | "upright";
  readonly twoHanded: boolean; readonly scale: number; readonly bob: number; readonly sway: number;
  readonly rawMain: MainHandPlacement; readonly swinging: boolean; readonly snap: PlayerSnapshot;
  readonly hands: FrameHandSockets | null; readonly activeClip?: string | undefined;
}): MainHandPlacement {
  if (opts.swinging) return { ...opts.rawMain, y: opts.rawMain.y + HELD_Y_OFFSET_3D, behindBody: opts.yawIdx >= 4 };
  if (is3dTwoHandBlock(opts.snap.blocking, opts.twoHanded, opts.aimMode)) {
    return compute3dTwoHandBlock({ yawIdx: opts.yawIdx, scale: opts.scale, bob: opts.bob });
  }
  if (shouldUse3dBowAim({ aimMode: opts.aimMode, activeClip: opts.activeClip, bowCharge: opts.snap.bowCharge })) {
    return compute3dBowAim({
      aimX: opts.snap.aimX ?? opts.snap.facingX, aimY: opts.snap.aimY ?? opts.snap.facingY,
      yawIdx: opts.yawIdx, scale: opts.scale, bob: opts.bob, hands: opts.hands, flipX: opts.flipX,
    });
  }
  const carryMode = opts.aimMode === "aim360" ? "upright" : opts.aimMode;
  if (opts.hands) {
    return socketMainCarry({ right: opts.hands.right, yawIdx: opts.yawIdx, body: opts.body, aimMode: carryMode, scale: opts.scale });
  }
  return pickLegacyCarryPose({ ...opts, aimMode: carryMode });
}

function compute3dOffhand(opts: {
  readonly yawIdx: number; readonly body?: string | undefined; readonly rawOff: OffhandPlacement;
  readonly bob: number; readonly sway: number; readonly hands: FrameHandSockets | null;
}): OffhandPlacement {
  if (opts.rawOff.kind === "none") return opts.rawOff;
  if (opts.rawOff.kind === "hipLantern") {
    const p = projectOrbit3d(opts.yawIdx, { lx: 0.24, ly: -0.04, lz: 0.62 });
    return { kind: "hipLantern", x: p.x, y: p.y + opts.bob * 0.4, rotation: 0, behindBody: p.behind };
  }
  const c = getTunedLanternArm(opts.yawIdx, opts.body);
  if (opts.hands) {
    const lh = opts.hands.left;
    return { kind: "handLantern", x: lh.x, y: lh.y, rotation: (lh.angle - Math.PI * 0.5) * 0.16, behindBody: c.behind };
  }
  return { kind: "handLantern", x: c.x, y: c.y + opts.bob * 0.6, rotation: c.rot + opts.sway * 0.6, behindBody: c.behind };
}

function compute3dShield(opts: {
  readonly yawIdx: number; readonly body?: string | undefined; readonly rawShield: ShieldPlacement;
  readonly blocking: boolean; readonly bob: number; readonly hands: FrameHandSockets | null;
}): ShieldPlacement {
  if (!opts.rawShield.equipped) return opts.rawShield;
  const scaleSign = opts.yawIdx >= 4 && opts.yawIdx <= 7 ? -1 : 1;
  if (opts.blocking) {
    const p = projectOrbit3d(opts.yawIdx, { lx: 0.1, ly: -0.28, lz: 0.84 });
    return { equipped: true, x: p.x, y: p.y + opts.bob * 0.45, rotation: 0.08 * scaleSign, scaleX: CHARACTER_WORLD_SCALE * scaleSign, behindBody: p.behind };
  }
  const c = getTunedLanternArm(opts.yawIdx, opts.body);
  if (opts.hands) {
    const lh = opts.hands.left;
    return { equipped: true, x: lh.x, y: lh.y, rotation: (lh.angle - Math.PI * 0.5) * 0.14, scaleX: CHARACTER_WORLD_SCALE * scaleSign, behindBody: c.behind };
  }
  return { equipped: true, x: c.x, y: c.y + opts.bob * 0.45, rotation: 0.08 * scaleSign, scaleX: CHARACTER_WORLD_SCALE * scaleSign, behindBody: c.behind };
}

function resolve3dYawIdx(snap: PlayerSnapshot, active?: PoseLocator): number {
  if (active) return resolveDir8Idx(active.dir, active.flipX);
  const f = resolveFacingDir8(snap.aimX ?? snap.facingX, snap.aimY ?? snap.facingY);
  return resolveDir8Idx(f.dir, f.flipX);
}

function resolveAimTime(opts: { readonly is3d: boolean; readonly moving: boolean; readonly sprinting: boolean; readonly swingProgress: number; readonly timeSec: number }): number {
  if (!opts.is3d || opts.swingProgress > 0) return opts.timeSec;
  if (!opts.moving) return 0;
  const fps = opts.sprinting ? 11 : 7;
  return Math.floor(opts.timeSec * fps) / fps;
}

function computeWalkRunMotion(opts: {
  readonly idleStatic: boolean; readonly sprinting: boolean; readonly aimTime: number;
  readonly activeBob: number; readonly gaitPhase?: number | undefined;
}): { readonly bob: number; readonly sway: number } {
  if (opts.idleStatic) return { bob: opts.activeBob * 0.35, sway: 0 };
  const bobAmp = opts.sprinting ? 0.55 : 0.28;
  const swayAmp = opts.sprinting ? 0.05 : 0.025;
  if (opts.gaitPhase !== undefined) {
    const stepRad = (gaitFrameIndex(opts.gaitPhase, 6) / 6) * Math.PI * 2;
    return { bob: -Math.abs(Math.sin(stepRad)) * bobAmp, sway: Math.sin(stepRad) * swayAmp };
  }
  return { bob: Math.sin(opts.aimTime * (opts.sprinting ? 14 : 9)) * bobAmp, sway: Math.sin(opts.aimTime * (opts.sprinting ? 11 : 7)) * swayAmp };
}

const CLIP_SOCKET_ALIAS: Readonly<Record<string, string>> = {
  crouchIdle: "crouch_idle",
  crouchWalk: "crouch_walk",
};

function sampleActiveHands(body: string | undefined, active?: PoseLocator): FrameHandSockets | null {
  if (!active) return null;
  const g = body === "female" ? "female" : "male";
  const clip = CLIP_SOCKET_ALIAS[active.clip] ?? active.clip;
  return sampleHandSockets({ body: g, clip, dir: active.dir, frameIdx: active.frameIdx, flipX: active.flipX });
}

function resolve3dCarryMotion(opts: {
  readonly snap: PlayerSnapshot; readonly aimTime: number; readonly active?: PoseLocator | undefined; readonly gaitPhase?: number | undefined;
}): { readonly bob: number; readonly sway: number } {
  const { snap, aimTime, active, gaitPhase } = opts;
  const idleStatic = !snap.moving && (snap.swingProgress ?? 0) === 0;
  return computeWalkRunMotion({ idleStatic, sprinting: Boolean(snap.sprinting), aimTime, activeBob: active?.pose.bobY ?? 0, gaitPhase });
}

function build3dHeldLayout(opts: {
  readonly snap: PlayerSnapshot; readonly v: { readonly twoHanded: boolean; readonly aimMode: "aim360" | "meleeCarry" | "upright"; readonly spriteScale: number };
  readonly aimTime: number; readonly raw: HeldLayout; readonly active?: PoseLocator | undefined; readonly gaitPhase?: number | undefined;
}): HeldLayout {
  const { snap, v, aimTime, raw, active, gaitPhase } = opts;
  const swinging = (snap.swingProgress ?? 0) > 0;
  const yawIdx = resolve3dYawIdx(snap, active);
  const body = snap.appearance?.body;
  const { bob, sway } = resolve3dCarryMotion({ snap, aimTime, active, gaitPhase });
  const hands = sampleActiveHands(body, active);
  const flipX = Boolean(active?.flipX);
  return {
    main: compute3dMainCarry({ yawIdx, flipX, body, aimMode: v.aimMode, twoHanded: v.twoHanded, scale: v.spriteScale, bob, sway, rawMain: raw.main, swinging, snap, hands, activeClip: active?.clip }),
    offhand: compute3dOffhand({ yawIdx, body, rawOff: raw.offhand, bob, sway, hands }),
    shield: compute3dShield({ yawIdx, body, rawShield: raw.shield, blocking: Boolean(snap.blocking), bob, hands }),
  };
}

function buildRawLayout(opts: {
  readonly snap: PlayerSnapshot; readonly v: { readonly twoHanded: boolean; readonly aimMode: "aim360" | "meleeCarry" | "upright"; readonly spriteScale: number };
  readonly aimTime: number;
}): HeldLayout {
  const { snap, v, aimTime } = opts;
  return computeHeldLayout({
    aimX: snap.aimX ?? snap.facingX, aimY: snap.aimY ?? snap.facingY, heldItem: snap.heldItem ?? null,
    torchLit: snap.torchLit, twoHanded: v.twoHanded, aimMode: v.aimMode, itemScale: v.spriteScale,
    timeSec: aimTime, moving: snap.moving, hasShield: snap.armor?.offhand === "wooden-shield",
    blocking: Boolean(snap.blocking), swingProgress: snap.swingProgress ?? 0, comboStep: snap.comboStep ?? 0,
  });
}

export function gearLayoutFor(opts: {
  readonly snap: PlayerSnapshot; readonly visual: HeldWeaponVisual | null;
  readonly timeSec: number; readonly is3d: boolean; readonly active?: PoseLocator | undefined; readonly gaitPhase?: number | undefined;
}): HeldLayout {
  const { snap, visual, timeSec, is3d, active, gaitPhase } = opts;
  const v = visual ?? FALLBACK_VISUAL;
  const aimTime = resolveAimTime({ is3d, moving: snap.moving, sprinting: Boolean(snap.sprinting), swingProgress: snap.swingProgress ?? 0, timeSec });
  const raw = buildRawLayout({ snap, v, aimTime });
  return is3d ? build3dHeldLayout({ snap, v, aimTime, raw, active, gaitPhase }) : raw;
}
