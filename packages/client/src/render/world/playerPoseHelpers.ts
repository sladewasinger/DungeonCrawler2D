/** Pure pose-track selection, 3D 8-dir orbit carry projection, and combat FX helpers for PlayerView. */
import { SKIN_PALETTES } from "@dc2d/content";
import { gaitFrameIndex, type PlayerSnapshot } from "@dc2d/engine";
import type { Texture } from "pixi.js";
import { computeArmRig, type AirborneState, type ArmRigPose } from "../character/armRig.js";
import { CHARACTER_WORLD_SCALE, resolveFacingDir, resolveFacingDir8, type DirectionAnim } from "../character/characterSprites.js";
import { FALL_POSES, IDLE_POSES, JUMP_POSES, RUN_POSES, WALK_POSES, type CharacterPose, type FacingDir } from "../character/characterTypes.js";
import {
  computeActorCombatFx, computeHeldLayout, resolveAimCardinal,
  type CardinalFacing, type HeldLayout, type MainHandPlacement, type OffhandPlacement, type ShieldPlacement,
} from "../character/heldPlacement.js";
import type { HeldWeaponVisual } from "../character/heldWeapons.js";
import { getTunedBowConfig, getTunedLanternArm, getTunedSwordArm } from "../poseTuning/poseTuningHelpers.js";
import type { BowAimDirTune } from "../poseTuning/poseTuningTypes.js";

const FALLBACK_VISUAL = { twoHanded: false, aimMode: "upright" as const, spriteScale: CHARACTER_WORLD_SCALE };
const HELD_Y_OFFSET_3D = -1.8;
const COS_38 = 0.78801;
const SIN_38 = 0.61566;

const UPRIGHT_TILT = [-0.14, -0.06, 0.14, 0.22, 0.14, -0.22, -0.14, 0.06] as const;

export interface PoseTrack {
  readonly clip: string; readonly textures: readonly Texture[];
  readonly poses: readonly CharacterPose[]; readonly fps: number; readonly airborne: AirborneState;
}
export interface ActivePose {
  readonly facing: CardinalFacing; readonly dir: FacingDir; readonly flipX: boolean;
  readonly clip: string; readonly frameIdx: number; readonly pose: CharacterPose; readonly airborne: AirborneState;
}

export function skinTint(skinId: string): number {
  const pal = SKIN_PALETTES[skinId] ?? SKIN_PALETTES.warm;
  return pal ? Number.parseInt(pal.base.slice(1), 16) : 0xecc096;
}

export function cardinalFromDir(dir: FacingDir, flipX: boolean): CardinalFacing {
  if (dir === "north" || dir === "south") return dir;
  return flipX ? "west" : "east";
}

const DIR8_MIRRORED_IDX: Readonly<Record<FacingDir, readonly [number, number]>> = {
  south: [0, 0],
  se: [1, 7],
  side: [2, 6],
  ne: [3, 5],
  north: [4, 4],
};

export function resolveDir8Idx(dir: FacingDir, flipX: boolean): number {
  return DIR8_MIRRORED_IDX[dir][flipX ? 1 : 0];
}

function projectOrbit3d(yawIdx: number, local: { readonly lx: number; readonly ly: number; readonly lz: number }) {
  const rad = yawIdx * (Math.PI / 4);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = local.lx * cos - local.ly * sin;
  const ry = local.lx * sin + local.ly * cos;
  return { x: rx * 16, y: -(local.lz * COS_38 + ry * SIN_38) * 16 - 0.8, behind: ry > 0.01 };
}

export function resolvePlayerFacing(opts: {
  readonly snap: PlayerSnapshot; readonly is3d: boolean; readonly prev: { readonly dir: FacingDir; readonly flipX: boolean };
}): { readonly dir: FacingDir; readonly flipX: boolean } {
  return opts.is3d ? resolveFacingDir8(opts.snap.facingX, opts.snap.facingY, opts.prev) : resolveFacingDir(opts.snap.facingX, opts.snap.facingY);
}

export function computePlayerCombatFx(snap: PlayerSnapshot, timeSec: number, is3d: boolean) {
  return computeActorCombatFx({
    aimX: snap.aimX ?? snap.facingX, aimY: snap.aimY ?? snap.facingY, facingX: snap.facingX,
    swingProgress: snap.swingProgress ?? 0, comboStep: snap.comboStep ?? 1,
    dodging: Boolean(snap.dodging), staggered: (snap.staggerTimer ?? 0) > 0,
    hitTimer: snap.hitTimer, downed: (snap.respawnTimer ?? 0) > 0, timeSec, is3d,
  });
}

function compute3dBowAim(opts: {
  readonly aimX: number; readonly aimY: number; readonly scale: number; readonly bob: number; readonly bow: BowAimDirTune;
}): MainHandPlacement {
  const mag = Math.hypot(opts.aimX, opts.aimY);
  const ax = mag < 0.01 ? 0 : opts.aimX / mag;
  const ay = mag < 0.01 ? 1 : opts.aimY / mag;
  const { bow } = opts;
  return {
    x: ax * bow.radiusX + bow.offsetX,
    y: bow.centerY + ay * bow.radiusY + bow.offsetY + opts.bob * 0.4,
    rotation: Math.atan2(ay, ax),
    scaleX: opts.scale,
    scaleY: ax < -0.05 ? -opts.scale : opts.scale,
    behindBody: bow.behindBody,
  };
}

function compute3dMainCarry(opts: {
  readonly yawIdx: number; readonly body?: string | undefined; readonly aimMode: "aim360" | "meleeCarry" | "upright";
  readonly scale: number; readonly bob: number; readonly sway: number;
  readonly rawMain: MainHandPlacement; readonly swinging: boolean; readonly snap: PlayerSnapshot;
}): MainHandPlacement {
  if (opts.swinging) return { ...opts.rawMain, y: opts.rawMain.y + HELD_Y_OFFSET_3D, behindBody: opts.yawIdx >= 4 };
  if (opts.aimMode === "aim360") {
    return compute3dBowAim({
      aimX: opts.snap.aimX ?? opts.snap.facingX, aimY: opts.snap.aimY ?? opts.snap.facingY,
      scale: opts.scale, bob: opts.bob, bow: getTunedBowConfig(opts.yawIdx, opts.body),
    });
  }
  const c = getTunedSwordArm(opts.yawIdx, opts.body);
  if (opts.aimMode === "upright") {
    return { x: c.x, y: c.y + opts.bob, rotation: UPRIGHT_TILT[opts.yawIdx] ?? 0, scaleX: opts.scale * c.scaleSign, scaleY: opts.scale, behindBody: c.behind };
  }
  return { x: c.x, y: c.y + opts.bob, rotation: c.rot + c.rotSign * opts.sway, scaleX: c.scaleSign * opts.scale, scaleY: opts.scale, behindBody: c.behind };
}

function compute3dOffhand(opts: {
  readonly yawIdx: number; readonly body?: string | undefined; readonly rawOff: OffhandPlacement; readonly bob: number; readonly sway: number;
}): OffhandPlacement {
  if (opts.rawOff.kind === "none") return opts.rawOff;
  if (opts.rawOff.kind === "hipLantern") {
    const p = projectOrbit3d(opts.yawIdx, { lx: 0.24, ly: -0.04, lz: 0.62 });
    return { kind: "hipLantern", x: p.x, y: p.y + opts.bob * 0.4, rotation: 0, behindBody: p.behind };
  }
  const c = getTunedLanternArm(opts.yawIdx, opts.body);
  return { kind: "handLantern", x: c.x, y: c.y + opts.bob * 0.6, rotation: c.rot + opts.sway * 0.6, behindBody: c.behind };
}

function compute3dShield(opts: {
  readonly yawIdx: number; readonly body?: string | undefined; readonly rawShield: ShieldPlacement; readonly blocking: boolean; readonly bob: number;
}): ShieldPlacement {
  if (!opts.rawShield.equipped) return opts.rawShield;
  const c = getTunedLanternArm(opts.yawIdx, opts.body);
  const p = opts.blocking ? projectOrbit3d(opts.yawIdx, { lx: 0.1, ly: -0.28, lz: 0.84 }) : c;
  const scaleSign = opts.yawIdx >= 4 && opts.yawIdx <= 7 ? -1 : 1;
  return { equipped: true, x: p.x, y: p.y + opts.bob * 0.45, rotation: 0.08 * scaleSign, scaleX: CHARACTER_WORLD_SCALE * scaleSign, behindBody: p.behind };
}

function resolve3dYawIdx(snap: PlayerSnapshot, active?: ActivePose): number {
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
  return {
    bob: Math.sin(opts.aimTime * (opts.sprinting ? 14 : 9)) * bobAmp,
    sway: Math.sin(opts.aimTime * (opts.sprinting ? 11 : 7)) * swayAmp,
  };
}

function build3dHeldLayout(opts: {
  readonly snap: PlayerSnapshot; readonly v: { readonly aimMode: "aim360" | "meleeCarry" | "upright"; readonly spriteScale: number };
  readonly aimTime: number; readonly raw: HeldLayout; readonly active?: ActivePose | undefined; readonly gaitPhase?: number | undefined;
}): HeldLayout {
  const { snap, v, aimTime, raw, active, gaitPhase } = opts;
  const swingProgress = snap.swingProgress ?? 0;
  const yawIdx = resolve3dYawIdx(snap, active);
  const body = snap.appearance?.body;
  const idleStatic = !snap.moving && swingProgress === 0;
  const { bob, sway } = computeWalkRunMotion({ idleStatic, sprinting: Boolean(snap.sprinting), aimTime, activeBob: active?.pose.bobY ?? 0, gaitPhase });
  return {
    main: compute3dMainCarry({ yawIdx, body, aimMode: v.aimMode, scale: v.spriteScale, bob, sway, rawMain: raw.main, swinging: swingProgress > 0, snap }),
    offhand: compute3dOffhand({ yawIdx, body, rawOff: raw.offhand, bob, sway }),
    shield: compute3dShield({ yawIdx, body, rawShield: raw.shield, blocking: Boolean(snap.blocking), bob }),
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
  readonly timeSec: number; readonly is3d: boolean; readonly active?: ActivePose | undefined; readonly gaitPhase?: number | undefined;
}): HeldLayout {
  const { snap, visual, timeSec, is3d, active, gaitPhase } = opts;
  const v = visual ?? FALLBACK_VISUAL;
  const aimTime = resolveAimTime({ is3d, moving: snap.moving, sprinting: Boolean(snap.sprinting), swingProgress: snap.swingProgress ?? 0, timeSec });
  const raw = buildRawLayout({ snap, v, aimTime });
  return is3d ? build3dHeldLayout({ snap, v, aimTime, raw, active, gaitPhase }) : raw;
}

function resolveMovingTrack(anim: DirectionAnim, sprinting: boolean): PoseTrack {
  if (!sprinting && anim.walk?.length) {
    return { clip: "walk", textures: anim.walk, poses: WALK_POSES, fps: 7, airborne: "ground" };
  }
  return { clip: "run", textures: anim.run, poses: RUN_POSES, fps: 11, airborne: "ground" };
}

function resolveAirOrGroundTrack(anim: DirectionAnim, snap: PlayerSnapshot, is3d: boolean): PoseTrack {
  if ((snap.jumpZ ?? 0) > 0.01) {
    return (snap.jumpVz ?? 0) > 0.35
      ? { clip: "jump", textures: anim.jump, poses: JUMP_POSES, fps: 8, airborne: "jump" }
      : { clip: "fall", textures: anim.fall, poses: FALL_POSES, fps: 8, airborne: "fall" };
  }
  if (snap.moving) return resolveMovingTrack(anim, Boolean(snap.sprinting));
  return { clip: "idle", textures: anim.idle, poses: IDLE_POSES, fps: is3d ? 6 : 5, airborne: "ground" };
}

export function resolvePoseTrack(opts: { readonly anim: DirectionAnim; readonly snap: PlayerSnapshot; readonly is3d: boolean }): PoseTrack {
  const { anim, snap, is3d } = opts;
  if ((snap.respawnTimer ?? 0) > 0 && anim.downed?.length) {
    return { clip: "downed", textures: anim.downed, poses: IDLE_POSES, fps: 4, airborne: "ground" };
  }
  if (snap.dodging && anim.dodge?.length) {
    return { clip: "dodge", textures: anim.dodge, poses: IDLE_POSES, fps: 16, airborne: "ground" };
  }
  return resolveAirOrGroundTrack(anim, snap, is3d);
}

export function computePoseFrameIdx(opts: {
  readonly track: PoseTrack; readonly timeSec: number; readonly dodgeStartSec: number | null; readonly gaitPhase?: number | undefined;
}): number {
  if (opts.track.clip === "dodge" && opts.dodgeStartSec !== null) {
    return Math.min(opts.track.textures.length - 1, Math.max(0, Math.floor((opts.timeSec - opts.dodgeStartSec) * opts.track.fps)));
  }
  if ((opts.track.clip === "walk" || opts.track.clip === "run") && opts.gaitPhase !== undefined) {
    return gaitFrameIndex(opts.gaitPhase, opts.track.textures.length);
  }
  return Math.floor(opts.timeSec * opts.track.fps) % opts.track.textures.length;
}

export function resolvePoseSnapshot(opts: {
  readonly anim: DirectionAnim; readonly facing: { readonly dir: FacingDir; readonly flipX: boolean };
  readonly snap: PlayerSnapshot; readonly is3d: boolean; readonly timeSec: number;
  readonly dodgeStartSec: number | null; readonly gaitPhase?: number | undefined;
}): { readonly active: ActivePose; readonly texture: Texture | undefined } {
  const track = resolvePoseTrack({ anim: opts.anim, snap: opts.snap, is3d: opts.is3d });
  const frameIdx = computePoseFrameIdx({ track, timeSec: opts.timeSec, dodgeStartSec: opts.dodgeStartSec, gaitPhase: opts.gaitPhase });
  return {
    texture: track.textures[frameIdx],
    active: {
      facing: cardinalFromDir(opts.facing.dir, opts.facing.flipX), dir: opts.facing.dir, flipX: opts.facing.flipX,
      clip: track.clip, frameIdx, pose: track.poses[frameIdx] ?? IDLE_POSES[0]!, airborne: track.airborne,
    },
  };
}

export function nextDodgeStart(dodging: boolean | undefined, timeSec: number, prev: number | null): number | null {
  return dodging ? (prev ?? timeSec) : null;
}

export function solveLegacyArmRigForSnap(opts: {
  readonly snap: PlayerSnapshot; readonly active: ActivePose; readonly layout: HeldLayout; readonly visual: HeldWeaponVisual | null;
}): ArmRigPose {
  const facing = resolveAimCardinal(opts.snap.aimX ?? opts.snap.facingX, opts.snap.aimY ?? opts.snap.facingY, opts.active.facing);
  return computeArmRig({
    facing, female: opts.snap.appearance?.body === "female", pose: opts.active.pose, airborneState: opts.active.airborne,
    grips: opts.visual?.grips ?? null, layout: opts.layout, bowCharge: opts.snap.bowCharge ?? 0, swinging: Boolean(opts.snap.swingProgress),
  });
}
