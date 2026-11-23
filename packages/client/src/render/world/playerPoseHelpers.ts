/** Pose-track selection, combat FX, swim bob, Pixi slot builders, and legacy arm rig helpers. */
import { gaitFrameIndex, type PlayerSnapshot } from "@dc2d/engine";
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { ARM_PIVOT_ANCHOR, computeArmRig, type AirborneState, type ArmRigPose } from "../character/armRig.js";
import { resolveFacingDir, resolveFacingDir8, type CharacterSpriteSet, type DirectionAnim } from "../character/characterSprites.js";
import { FALL_POSES, IDLE_POSES, JUMP_POSES, RUN_POSES, WALK_POSES, type CharacterPose, type FacingDir } from "../character/characterTypes.js";
import { computeActorCombatFx, resolveAimCardinal, type CardinalFacing, type HeldLayout } from "../character/heldPlacement.js";
import { getGrippingHandTexture, getShieldTexture, type HeldWeaponVisual } from "../character/heldWeapons.js";

export { gearLayoutFor, resolveDir8Idx, skinTint } from "./playerHeldLayout.js";

export interface PoseTrack {
  readonly clip: string; readonly textures: readonly Texture[];
  readonly poses: readonly CharacterPose[]; readonly fps: number; readonly airborne: AirborneState;
}
export interface ActivePose {
  readonly facing: CardinalFacing; readonly dir: FacingDir; readonly flipX: boolean;
  readonly clip: string; readonly frameIdx: number; readonly pose: CharacterPose; readonly airborne: AirborneState;
}

export function attachToSlot(slot: Container, child: Container): void { if (child.parent !== slot) slot.addChild(child); }
export function makeHandSprite(): Sprite { const s = new Sprite(getGrippingHandTexture()); s.anchor.set(0.5, 0.5); return s; }
export function makeArmSprite(): Sprite { const s = new Sprite(); s.anchor.set(ARM_PIVOT_ANCHOR.x, ARM_PIVOT_ANCHOR.y); return s; }
export function makeShieldSprite(): Sprite {
  const s = new Sprite(getShieldTexture());
  s.anchor.set(0.5, 0.5); s.zIndex = 2; s.visible = false; return s;
}
export function makeGroundShadow(): Graphics {
  const g = new Graphics();
  g.ellipse(0, 0, 7, 2.2).fill({ color: 0x0c1018, alpha: 0.34 });
  g.ellipse(0, 0, 5, 1.3).fill({ color: 0x0c1018, alpha: 0.2 });
  return g;
}
export function makeWaterRing(): Graphics {
  const g = new Graphics();
  g.ellipse(0, -4, 7.5, 2.8).stroke({ color: 0xbae6fd, width: 1.1, alpha: 0.65 });
  g.visible = false;
  return g;
}
export function makeWaterMask(): Graphics {
  const g = new Graphics();
  g.rect(-48, -96, 96, 90).fill(0xffffff);
  g.visible = false;
  return g;
}

export function cardinalFromDir(dir: FacingDir, flipX: boolean): CardinalFacing {
  return dir === "north" || dir === "south" ? dir : flipX ? "west" : "east";
}

function pickFacingVector(snap: PlayerSnapshot): { readonly dx: number; readonly dy: number } {
  const bowAim = snap.heldItem === "bow" && (!snap.moving || (snap.bowCharge ?? 0) > 0.02);
  if (!bowAim) return { dx: snap.facingX, dy: snap.facingY };
  return { dx: snap.aimX ?? snap.facingX, dy: snap.aimY ?? snap.facingY };
}

export function resolvePlayerFacing(opts: {
  readonly snap: PlayerSnapshot; readonly is3d: boolean; readonly prev: { readonly dir: FacingDir; readonly flipX: boolean };
}): { readonly dir: FacingDir; readonly flipX: boolean } {
  const { dx, dy } = pickFacingVector(opts.snap);
  return opts.is3d ? resolveFacingDir8(dx, dy, opts.prev) : resolveFacingDir(dx, dy);
}

export function computePlayerCombatFx(snap: PlayerSnapshot, timeSec: number, is3d: boolean) {
  return computeActorCombatFx({
    aimX: snap.aimX ?? snap.facingX, aimY: snap.aimY ?? snap.facingY, facingX: snap.facingX,
    swingProgress: snap.swingProgress ?? 0, comboStep: snap.comboStep ?? 1, heldItem: snap.heldItem ?? null,
    dodging: Boolean(snap.dodging), invulnTimer: snap.invulnTimer, staggered: (snap.staggerTimer ?? 0) > 0,
    hitTimer: snap.hitTimer, downed: (snap.respawnTimer ?? 0) > 0, timeSec, is3d,
  });
}

export function resolveHeroAnimTrack(sprites: CharacterSpriteSet, dir: FacingDir): DirectionAnim {
  return sprites[dir] ?? sprites.south;
}

export const computeSwimDip = (swimming: boolean, timeSec: number): number =>
  (swimming ? 2.5 + Math.sin(timeSec * 5.2) * 0.7 : 0);

function resolveMovingTrack(anim: DirectionAnim, sprinting: boolean): PoseTrack {
  if (!sprinting && anim.walk?.length) return { clip: "walk", textures: anim.walk, poses: WALK_POSES, fps: 7, airborne: "ground" };
  return { clip: "run", textures: anim.run, poses: RUN_POSES, fps: 11, airborne: "ground" };
}

function resolveJumpTrack(anim: DirectionAnim, jumpVz: number | undefined): PoseTrack {
  return (jumpVz ?? 0) > 0.35
    ? { clip: "jump", textures: anim.jump, poses: JUMP_POSES, fps: 8, airborne: "jump" }
    : { clip: "fall", textures: anim.fall, poses: FALL_POSES, fps: 8, airborne: "fall" };
}

function isBowAiming(snap: PlayerSnapshot, anim: DirectionAnim): boolean {
  return snap.heldItem === "bow" && Boolean(anim.bow?.length) && (!snap.moving || (snap.bowCharge ?? 0) > 0.02);
}

function resolveGroundTrack(anim: DirectionAnim, snap: PlayerSnapshot, is3d: boolean): PoseTrack {
  if (isBowAiming(snap, anim)) return { clip: "bow", textures: anim.bow!, poses: IDLE_POSES, fps: 8, airborne: "ground" };
  if (snap.moving) return resolveMovingTrack(anim, Boolean(snap.sprinting));
  return { clip: "idle", textures: anim.idle, poses: IDLE_POSES, fps: is3d ? 6 : 5, airborne: "ground" };
}

function resolveAirOrGroundTrack(anim: DirectionAnim, snap: PlayerSnapshot, is3d: boolean): PoseTrack {
  if ((snap.jumpZ ?? 0) > 0.01) return resolveJumpTrack(anim, snap.jumpVz);
  if (snap.inDeepWater && anim.swim?.length) return { clip: "swim", textures: anim.swim, poses: IDLE_POSES, fps: 6, airborne: "ground" };
  return resolveGroundTrack(anim, snap, is3d);
}

export function resolvePoseTrack(opts: { readonly anim: DirectionAnim; readonly snap: PlayerSnapshot; readonly is3d: boolean }): PoseTrack {
  const { anim, snap, is3d } = opts;
  if ((snap.respawnTimer ?? 0) > 0 && anim.downed?.length) return { clip: "downed", textures: anim.downed, poses: IDLE_POSES, fps: 4, airborne: "ground" };
  if (snap.dodging && anim.dodge?.length) return { clip: "dodge", textures: anim.dodge, poses: IDLE_POSES, fps: 16, airborne: "ground" };
  return resolveAirOrGroundTrack(anim, snap, is3d);
}

function computeBowFrameIdx(count: number, bowCharge: number | undefined): number {
  if (count <= 1 || (bowCharge ?? 0) <= 0.05) return 0;
  return Math.min(count - 1, 1 + Math.floor(Math.min(0.999, bowCharge!) * (count - 1)));
}

export function computePoseFrameIdx(opts: {
  readonly track: PoseTrack; readonly timeSec: number; readonly dodgeStartSec: number | null;
  readonly gaitPhase?: number | undefined; readonly bowCharge?: number | undefined;
}): number {
  const { track, timeSec, dodgeStartSec, gaitPhase, bowCharge } = opts;
  if (track.clip === "bow") return computeBowFrameIdx(track.textures.length, bowCharge);
  if (track.clip === "dodge" && dodgeStartSec !== null) {
    return Math.min(track.textures.length - 1, Math.max(0, Math.floor((timeSec - dodgeStartSec) * track.fps)));
  }
  if ((track.clip === "walk" || track.clip === "run") && gaitPhase !== undefined) return gaitFrameIndex(gaitPhase, track.textures.length);
  return Math.floor(timeSec * track.fps) % track.textures.length;
}

export function resolvePoseSnapshot(opts: {
  readonly anim: DirectionAnim; readonly facing: { readonly dir: FacingDir; readonly flipX: boolean };
  readonly snap: PlayerSnapshot; readonly is3d: boolean; readonly timeSec: number;
  readonly dodgeStartSec: number | null; readonly gaitPhase?: number | undefined;
}): { readonly active: ActivePose; readonly texture: Texture | undefined } {
  const track = resolvePoseTrack(opts);
  const frameIdx = computePoseFrameIdx({
    track, timeSec: opts.timeSec, dodgeStartSec: opts.dodgeStartSec, gaitPhase: opts.gaitPhase, bowCharge: opts.snap.bowCharge,
  });
  return {
    texture: track.textures[frameIdx],
    active: {
      facing: cardinalFromDir(opts.facing.dir, opts.facing.flipX), dir: opts.facing.dir, flipX: opts.facing.flipX,
      clip: track.clip, frameIdx, pose: track.poses[frameIdx] ?? IDLE_POSES[0]!, airborne: track.airborne,
    },
  };
}

export const nextDodgeStart = (dodging: boolean | undefined, timeSec: number, prev: number | null): number | null => (dodging ? (prev ?? timeSec) : null);

function drawDashedBowRay(g: Graphics, opts: { readonly nx: number; readonly ny: number; readonly charge: number }): void {
  const alpha = opts.charge > 0.05 ? 0.34 + opts.charge * 0.28 : 0.22;
  const color = opts.charge >= 0.7 ? 0xfde047 : 0xf8fafc;
  const span = opts.charge > 0.05 ? 64 : 48;
  g.clear();
  for (let d = 12; d < span; d += 7) {
    const end = Math.min(span, d + 4);
    g.moveTo(opts.nx * d, -8 + opts.ny * d * 0.85).lineTo(opts.nx * end, -8 + opts.ny * end * 0.85);
  }
  g.stroke({ color, width: 1.2, alpha });
  g.circle(opts.nx * (span + 2), -8 + opts.ny * (span + 2) * 0.85, opts.charge > 0.05 ? 1.5 : 1.1).fill({ color, alpha: alpha + 0.12 });
  g.visible = true;
}

export function syncBowAimGuide(g: Graphics, snap: PlayerSnapshot, hidden: boolean): void {
  if (hidden || snap.heldItem !== "bow") { g.visible = false; return; }
  const ax = snap.aimX ?? snap.facingX;
  const ay = snap.aimY ?? snap.facingY;
  const mag = Math.hypot(ax, ay);
  if (mag < 0.01) { g.visible = false; return; }
  drawDashedBowRay(g, { nx: ax / mag, ny: ay / mag, charge: snap.bowCharge ?? 0 });
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
