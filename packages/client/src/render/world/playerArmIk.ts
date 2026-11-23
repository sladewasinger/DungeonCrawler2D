/** Two-segment analytical elbow IK solver and sprite rig for 3D-hybrid character arms. */
import { Container, Sprite } from "pixi.js";
import { transformWeaponSocket, type AirborneState } from "../character/armRig.js";
import type { ArmSegmentTextures, CharacterPose, FacingDir } from "../character/characterTypes.js";
import type { HeldLayout } from "../character/heldPlacement.js";
import type { GripSocket, WeaponGripSockets } from "../character/heldWeapons.js";
import type { FrameSockets, ShoulderSocket } from "../character/playerAssets.js";
import { computeTunedFreeArm, getTunedBowConfig, getTunedLanternArm, getTunedSwordArm } from "../poseTuning/poseTuningHelpers.js";
import type { BowAimDirTune } from "../poseTuning/poseTuningTypes.js";
import { resolveDir8Idx } from "./playerPoseHelpers.js";

const UPPER_ARM_LEN = 2.8;
const FOREARM_LEN = 3.4;
const MAX_STRETCH = 1.32;
const UPPER_ANCHOR = { x: 5 / 20, y: 0.5 } as const;
const FORE_ANCHOR = { x: 5 / 22, y: 0.5 } as const;

export interface Point2D { readonly x: number; readonly y: number; }
export interface TwoBoneIkInput {
  readonly sx: number; readonly sy: number; readonly tx: number; readonly ty: number;
  readonly l1: number; readonly l2: number; readonly bendSign: number; readonly maxBendRad?: number | undefined;
}
export interface TwoBoneIkResult {
  readonly sx: number; readonly sy: number; readonly ex: number; readonly ey: number;
  readonly upperAngle: number; readonly foreAngle: number; readonly stretch: number;
}
export interface TwoSegmentArmPose {
  readonly ik: TwoBoneIkResult; readonly behindBody: boolean; readonly upperBehind: boolean;
  readonly handBehind: boolean; readonly overWeapon: boolean; readonly shaded: boolean;
  readonly showFreeHand: boolean; readonly taper: boolean;
}
export interface TwoSegmentRigPose { readonly right: TwoSegmentArmPose; readonly left: TwoSegmentArmPose; }

function solveWithinReach(opts: {
  readonly input: TwoBoneIkInput; readonly rawDist: number; readonly baseAngle: number;
}): TwoBoneIkResult {
  const { sx, sy, tx, ty, l1, l2, bendSign, maxBendRad } = opts.input;
  const d = Math.max(Math.abs(l1 - l2) + 0.05, opts.rawDist);
  const cosAlpha = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const rawAlpha = Math.acos(cosAlpha);
  const clamped = maxBendRad !== undefined && opts.rawDist >= 1e-4 && rawAlpha > maxBendRad;
  const alpha = clamped ? maxBendRad : rawAlpha;
  const stretch = clamped ? Math.max(0.45, Math.min(1, opts.rawDist / (Math.cos(alpha) * (l1 + l2)))) : 1;
  const upperAngle = opts.baseAngle + (bendSign >= 0 ? 1 : -1) * alpha;
  const ex = sx + Math.cos(upperAngle) * l1 * stretch;
  const ey = sy + Math.sin(upperAngle) * l1 * stretch;
  const foreAngle = opts.rawDist < 1e-4 ? opts.baseAngle : Math.atan2(ty - ey, tx - ex);
  return { sx, sy, ex, ey, upperAngle, foreAngle, stretch };
}

/** Solve 2D two-bone analytical elbow IK from shoulder (sx, sy) to target (tx, ty). */
export function solveTwoBoneIk(input: TwoBoneIkInput): TwoBoneIkResult {
  const { sx, sy, tx, ty, l1, l2 } = input;
  const rawDist = Math.hypot(tx - sx, ty - sy);
  const baseAngle = rawDist < 1e-4 ? Math.PI / 2 : Math.atan2(ty - sy, tx - sx);
  const maxReach = l1 + l2;
  if (rawDist < maxReach) return solveWithinReach({ input, rawDist, baseAngle });
  const stretch = Math.min(MAX_STRETCH, rawDist / maxReach);
  return { sx, sy, ex: sx + Math.cos(baseAngle) * l1 * stretch, ey: sy + Math.sin(baseAngle) * l1 * stretch, upperAngle: baseAngle, foreAngle: baseAngle, stretch };
}

const DIAG_DIRS = new Set<FacingDir>(["se", "ne"]);
const useFacingSign = (dir: FacingDir, behind: boolean): boolean => dir === "side" || (!behind && DIAG_DIRS.has(dir));
const isHorizontalReach = (dx: number, dy: number): boolean => Math.abs(dy) < Math.abs(dx) * 0.65 && Math.abs(dx) > 1.8;
const resolveStableBehind = (dir: FacingDir, raw: boolean): boolean => dir === "north" || (dir !== "south" && raw);

function resolveBendSign(opts: {
  readonly dir: FacingDir; readonly sx: number; readonly dx: number;
  readonly dy: number; readonly flipX: boolean; readonly behindBody: boolean;
}): number {
  if (useFacingSign(opts.dir, opts.behindBody)) return opts.flipX ? -1 : 1;
  if (isHorizontalReach(opts.dx, opts.dy)) return opts.dx >= 0 ? 1 : -1;
  return opts.sx >= 0 ? -1 : 1;
}

function freeArmTarget(opts: { readonly socket: ShoulderSocket; readonly pose: CharacterPose; readonly airborne: AirborneState; readonly isRight: boolean; readonly dir: FacingDir }): Point2D {
  const { socket, pose, airborne, isRight, dir } = opts;
  const swingDir = isRight ? 1 : -1;
  const outSign = Math.sign(socket.x) || -swingDir;
  const swingPx = pose.armSwing * swingDir * 0.9;
  if (airborne === "jump") return { x: socket.x + outSign * 1.8, y: socket.y - 2.2 };
  if (airborne === "fall") return { x: socket.x + outSign * 2.2, y: socket.y - 3.0 };
  if (dir === "north" || dir === "south") return { x: socket.x + outSign * 0.95, y: socket.y + 6.0 + swingPx * 0.3 };
  return { x: socket.x + swingPx, y: socket.y + 6.0 };
}

function solveArmPose(opts: {
  readonly socket: ShoulderSocket; readonly dir: FacingDir; readonly target: Point2D; readonly flipX: boolean;
  readonly behindBody: boolean; readonly upperBehind?: boolean | undefined; readonly handBehind?: boolean | undefined;
  readonly shaded?: boolean | undefined; readonly bendSignOverride?: -1 | 0 | 1 | undefined;
  readonly overWeapon: boolean; readonly showFreeHand: boolean; readonly maxBendRad?: number | undefined; readonly taper?: boolean | undefined;
}): TwoSegmentArmPose {
  const { socket, dir, target, flipX } = opts;
  const bendSign = opts.bendSignOverride ? opts.bendSignOverride : resolveBendSign({ dir, sx: socket.x, dx: target.x - socket.x, dy: target.y - socket.y, flipX, behindBody: opts.behindBody });
  const ik = solveTwoBoneIk({ sx: socket.x, sy: socket.y, tx: target.x, ty: target.y, l1: UPPER_ARM_LEN, l2: FOREARM_LEN, bendSign, maxBendRad: opts.maxBendRad ?? 0.22 });
  const shaded = opts.shaded ?? (dir === "north" ? false : resolveStableBehind(dir, socket.behind));
  return {
    ik, behindBody: opts.behindBody, upperBehind: opts.upperBehind ?? opts.behindBody, handBehind: opts.handBehind ?? opts.behindBody,
    overWeapon: opts.overWeapon, shaded, showFreeHand: opts.showFreeHand, taper: opts.taper ?? opts.behindBody,
  };
}

function bowSideParams(opts: { readonly bow: BowAimDirTune; readonly isDraw: boolean; readonly bowBehind: boolean; readonly overWeapon: boolean }) {
  const { bow, isDraw, bowBehind, overWeapon } = opts;
  return { armBehind: isDraw ? bow.drawArmBehind : bow.bowArmBehind || bowBehind, overWeapon: isDraw && overWeapon, maxBendRad: isDraw ? bow.drawMaxBendRad : bow.gripMaxBendRad };
}

function buildBowRig(opts: {
  readonly sockets: FrameSockets; readonly dir: FacingDir; readonly yawIdx: number; readonly body?: string | undefined; readonly layout: HeldLayout;
  readonly grips: WeaponGripSockets; readonly secondary: GripSocket; readonly bowCharge: number; readonly flipX: boolean;
}): TwoSegmentRigPose {
  const { sockets, dir, yawIdx, body, layout, grips, secondary, bowCharge, flipX } = opts;
  const bow = getTunedBowConfig(yawIdx, body);
  const p1 = transformWeaponSocket(layout.main, grips.primary);
  const p2 = transformWeaponSocket(layout.main, bowCharge > 0 ? { ...secondary, x: secondary.x - bowCharge * bow.drawPull } : secondary);
  const swap = layout.main.scaleY < 0;
  const bowBehind = bow.behindBody || layout.main.behindBody;
  const overWeapon = bow.drawArmOverWeapon && Boolean(secondary.overWeapon);
  const rp = bowSideParams({ bow, isDraw: !swap, bowBehind, overWeapon });
  const lp = bowSideParams({ bow, isDraw: swap, bowBehind, overWeapon });
  return {
    right: solveArmPose({ socket: sockets.right, dir, target: swap ? p1 : p2, flipX, behindBody: rp.armBehind, overWeapon: rp.overWeapon, showFreeHand: false, maxBendRad: rp.maxBendRad }),
    left: solveArmPose({ socket: sockets.left, dir, target: swap ? p2 : p1, flipX, behindBody: lp.armBehind, overWeapon: lp.overWeapon, showFreeHand: false, maxBendRad: lp.maxBendRad }),
  };
}

function solveFreeArm(opts: {
  readonly socket: ShoulderSocket; readonly dir: FacingDir; readonly yawIdx: number; readonly body?: string | undefined;
  readonly pose: CharacterPose; readonly airborne: AirborneState; readonly isRight: boolean; readonly flipX: boolean;
}): TwoSegmentArmPose {
  const { socket, dir, yawIdx, body, pose, airborne, isRight, flipX } = opts;
  if (airborne === "ground") {
    const t = computeTunedFreeArm({ socket, dir, yawIdx, pose, isRight, body });
    return solveArmPose({
      socket: t.socket, dir, target: t.target, flipX, behindBody: t.behindBody, upperBehind: t.upperBehind,
      handBehind: t.handBehind, shaded: t.shaded, taper: t.taper, maxBendRad: t.maxBendRad,
      bendSignOverride: t.bendSign, overWeapon: false, showFreeHand: true,
    });
  }
  const target = freeArmTarget({ socket, pose, airborne, isRight, dir });
  const behindBody = dir === "north" || dir === "south" ? false : resolveStableBehind(dir, socket.behind);
  return solveArmPose({ socket, dir, target, flipX, behindBody, overWeapon: false, showFreeHand: true, maxBendRad: 0.22, taper: behindBody });
}

function solveRightCarryArm(opts: {
  readonly socket: ShoulderSocket; readonly dir: FacingDir; readonly yawIdx: number; readonly body?: string | undefined;
  readonly swinging?: boolean | undefined; readonly layout: HeldLayout; readonly grip: GripSocket; readonly flipX: boolean;
}): TwoSegmentArmPose {
  const sw = getTunedSwordArm(opts.yawIdx, opts.body);
  return solveArmPose({
    socket: opts.socket, dir: opts.dir, target: transformWeaponSocket(opts.layout.main, opts.grip), flipX: opts.flipX,
    behindBody: opts.swinging ? opts.layout.main.behindBody : sw.armBehind,
    shaded: opts.swinging ? undefined : sw.armShaded, taper: opts.swinging ? undefined : sw.armTaper,
    overWeapon: Boolean(opts.grip.overWeapon), showFreeHand: !opts.grip.showHand, maxBendRad: sw.maxBendRad,
  });
}

function resolveLeftHandState(opts: {
  readonly sockets: FrameSockets; readonly dir: FacingDir; readonly yawIdx: number; readonly body?: string | undefined; readonly flipX: boolean;
  readonly layout: HeldLayout; readonly pose: CharacterPose; readonly airborne: AirborneState;
}): TwoSegmentArmPose {
  const { sockets, dir, yawIdx, body, layout, flipX } = opts;
  const baseBehind = resolveStableBehind(dir, sockets.left.behind);
  if (layout.shield.equipped) return solveArmPose({ socket: sockets.left, dir, target: { x: layout.shield.x, y: layout.shield.y }, flipX, behindBody: baseBehind || layout.shield.behindBody, overWeapon: false, showFreeHand: false });
  if (layout.offhand.kind === "handLantern") {
    const lt = getTunedLanternArm(yawIdx, body);
    return solveArmPose({ socket: sockets.left, dir, target: { x: layout.offhand.x, y: layout.offhand.y }, flipX, behindBody: lt.armBehind, shaded: lt.armShaded, taper: lt.armTaper, maxBendRad: lt.maxBendRad, overWeapon: false, showFreeHand: false });
  }
  return solveFreeArm({ socket: sockets.left, dir, yawIdx, body, pose: opts.pose, airborne: opts.airborne, isRight: false, flipX });
}

/** Compute world-space 2-segment upper+forearm poses from baked Blender shoulder sockets. */
export function computeTwoSegmentArmRig(input: {
  readonly sockets: FrameSockets; readonly dir: FacingDir; readonly flipX: boolean; readonly layout: HeldLayout;
  readonly grips: WeaponGripSockets | null; readonly pose: CharacterPose; readonly airborne: AirborneState;
  readonly bowCharge: number; readonly body?: string | undefined; readonly swinging?: boolean | undefined;
}): TwoSegmentRigPose {
  const { sockets, dir, flipX, layout, grips, pose, airborne, bowCharge, body, swinging } = input;
  const yawIdx = resolveDir8Idx(dir, flipX);
  if (grips?.secondary) return buildBowRig({ sockets, dir, yawIdx, body, layout, grips, secondary: grips.secondary, bowCharge, flipX });
  const right = grips
    ? solveRightCarryArm({ socket: sockets.right, dir, yawIdx, body, swinging, layout, grip: grips.primary, flipX })
    : solveFreeArm({ socket: sockets.right, dir, yawIdx, body, pose, airborne, isRight: true, flipX });
  return { right, left: resolveLeftHandState({ sockets, dir, yawIdx, body, flipX, layout, pose, airborne }) };
}

interface ArmSpriteGroup {
  readonly back: Container; readonly front: Container; lastMask: number;
  readonly upperOut: Sprite; readonly foreOut: Sprite; readonly handOut: Sprite;
  readonly upper: Sprite; readonly fore: Sprite; readonly hand: Sprite;
}

function makeSegmentSprite(anchorX: number, anchorY: number): Sprite { const s = new Sprite(); s.anchor.set(anchorX, anchorY); return s; }

function makeArmGroup(): ArmSpriteGroup {
  return {
    back: new Container(), front: new Container(), lastMask: -1,
    upperOut: makeSegmentSprite(UPPER_ANCHOR.x, UPPER_ANCHOR.y), foreOut: makeSegmentSprite(FORE_ANCHOR.x, FORE_ANCHOR.y), handOut: makeSegmentSprite(0.5, 0.5),
    upper: makeSegmentSprite(UPPER_ANCHOR.x, UPPER_ANCHOR.y), fore: makeSegmentSprite(FORE_ANCHOR.x, FORE_ANCHOR.y), hand: makeSegmentSprite(0.5, 0.5),
  };
}

function pickArmSlot(g: ArmSpriteGroup, behind: boolean): Container { return behind ? g.back : g.front; }

function syncArmSlots(g: ArmSpriteGroup, pose: TwoSegmentArmPose): void {
  const mask = (pose.upperBehind ? 4 : 0) + (pose.behindBody ? 2 : 0) + (pose.handBehind ? 1 : 0);
  if (mask === g.lastMask) return;
  g.lastMask = mask;
  const uSlot = pickArmSlot(g, pose.upperBehind);
  const fSlot = pickArmSlot(g, pose.behindBody);
  const hSlot = pickArmSlot(g, pose.handBehind);
  uSlot.addChild(g.upperOut);
  fSlot.addChild(g.foreOut);
  hSlot.addChild(g.handOut);
  uSlot.addChild(g.upper);
  fSlot.addChild(g.fore);
  hSlot.addChild(g.hand);
}

interface TfOpts { readonly s: Sprite; readonly tex: Sprite["texture"]; readonly x: number; readonly y: number; readonly rot: number; readonly sx: number; readonly sy: number; }
function setSpriteTransform(o: TfOpts): void {
  o.s.texture = o.tex; o.s.position.set(o.x, o.y); o.s.rotation = o.rot; o.s.scale.set(o.sx, o.sy);
}

function syncFreeHand(opts: { readonly sprites: ArmSpriteGroup; readonly pose: TwoSegmentArmPose; readonly segments: ArmSegmentTextures; readonly worldScale: number }): void {
  const { sprites, pose, segments, worldScale } = opts;
  sprites.handOut.visible = pose.showFreeHand;
  sprites.hand.visible = pose.showFreeHand;
  if (!pose.showFreeHand) return;
  const reach = FOREARM_LEN * pose.ik.stretch;
  const wx = pose.ik.ex + Math.cos(pose.ik.foreAngle) * reach;
  const wy = pose.ik.ey + Math.sin(pose.ik.foreAngle) * reach;
  const hs = pose.taper ? worldScale * 0.85 : worldScale;
  setSpriteTransform({ s: sprites.handOut, tex: segments.handOutline, x: wx, y: wy, rot: pose.ik.foreAngle, sx: hs, sy: hs });
  setSpriteTransform({ s: sprites.hand, tex: pose.shaded ? segments.handFillBack : segments.handFillFront, x: wx, y: wy, rot: pose.ik.foreAngle, sx: hs, sy: hs });
}

function armScaleY(angle: number, thick: number): number { return Math.cos(angle) < -0.05 ? -thick : thick; }

/** Manages two-pass seamless PixiJS upper+forearm containers for the 3D Hero rig. */
export class PlayerArmRigView {
  private readonly rightArm = makeArmGroup();
  private readonly leftArm = makeArmGroup();

  setVisible(visible: boolean): void { for (const g of [this.rightArm, this.leftArm]) { g.back.visible = visible; g.front.visible = visible; } }

  setTint(tint: number): void {
    for (const g of [this.rightArm, this.leftArm]) {
      g.upperOut.tint = tint; g.foreOut.tint = tint; g.handOut.tint = tint;
      g.upper.tint = tint; g.fore.tint = tint; g.hand.tint = tint;
    }
  }

  apply(opts: { readonly rig: TwoSegmentRigPose; readonly segments: ArmSegmentTextures; readonly backSlot: Container; readonly frontSlot: Container; readonly worldScale: number }): void {
    this.applyArm({ pose: opts.rig.right, sprites: this.rightArm, segments: opts.segments, backSlot: opts.backSlot, frontSlot: opts.frontSlot, worldScale: opts.worldScale });
    this.applyArm({ pose: opts.rig.left, sprites: this.leftArm, segments: opts.segments, backSlot: opts.backSlot, frontSlot: opts.frontSlot, worldScale: opts.worldScale });
    this.setVisible(true);
  }

  private applyArm(opts: { readonly pose: TwoSegmentArmPose; readonly sprites: ArmSpriteGroup; readonly segments: ArmSegmentTextures; readonly backSlot: Container; readonly frontSlot: Container; readonly worldScale: number }): void {
    const { pose, sprites, segments, worldScale } = opts;
    const { ik } = pose;
    if (sprites.back.parent !== opts.backSlot) opts.backSlot.addChild(sprites.back);
    if (sprites.front.parent !== opts.frontSlot) opts.frontSlot.addChild(sprites.front);
    sprites.back.zIndex = 1;
    sprites.front.zIndex = pose.overWeapon ? 3 : 1;
    syncArmSlots(sprites, pose);
    const sx = worldScale * ik.stretch;
    const thick = pose.taper ? worldScale * 0.78 : worldScale;
    const uSy = armScaleY(ik.upperAngle, thick);
    const fSy = armScaleY(ik.foreAngle, thick);
    setSpriteTransform({ s: sprites.upperOut, tex: segments.upperOutline, x: ik.sx, y: ik.sy, rot: ik.upperAngle, sx, sy: uSy });
    setSpriteTransform({ s: sprites.foreOut, tex: segments.forearmOutline, x: ik.ex, y: ik.ey, rot: ik.foreAngle, sx, sy: fSy });
    setSpriteTransform({ s: sprites.upper, tex: pose.shaded ? segments.upperBack : segments.upperFront, x: ik.sx, y: ik.sy, rot: ik.upperAngle, sx, sy: uSy });
    setSpriteTransform({ s: sprites.fore, tex: pose.shaded ? segments.forearmBack : segments.forearmFront, x: ik.ex, y: ik.ey, rot: ik.foreAngle, sx, sy: fSy });
    syncFreeHand({ sprites, pose, segments, worldScale });
  }
}
