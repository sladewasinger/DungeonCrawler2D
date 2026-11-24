/** Renders 3D 8-dir Hero sprites with baked arms/hand sockets, 3D 8-dir bow overlay, dashed aim line, and swim mask. */
import { DEFAULT_APPEARANCE, JUMP_VISUAL_PX_PER_TILE, TILE_PX, advanceGaitClock, createGaitClock, type ArmorEquipment, type PlayerSnapshot } from "@dc2d/engine";
import { Container, Graphics, Sprite, type Text, type Texture } from "pixi.js";
import { drawPlayerWebOverlay } from "../combat/webs/webRenderer.js";
import type { ArmPlacement } from "../character/armRig.js";
import {
  CHARACTER_WORLD_SCALE, characterCacheKey, getCharacterCacheRevision, getCharacterSpriteSet,
  type CharacterSpriteSet, type FacingDir,
} from "../character/characterSprites.js";
import type { computeActorCombatFx, HeldLayout, OffhandPlacement, ShieldPlacement } from "../character/heldPlacement.js";
import { getGearScale, getGrippingHandTexture, getHeldWeaponVisual, getShieldTexture, getWaistLanternFrames, type HeldWeaponVisual } from "../character/heldWeapons.js";
import { getBowOverlayTexture } from "../character/playerAssets.js";
import { ELEVATION_LIFT_PX } from "./cliffStrips.js";
import { PlayerHpBar, createPlayerNameLabel } from "./playerHpBar.js";
import {
  PLAYER_WATERLINE, attachToSlot, computePlayerCombatFx, computeSwimDip, createWaterSubmergeRig, gearLayoutFor,
  makeArmSprite, makeGroundShadow, makeHandSprite, makeShieldSprite, nextDodgeStart, resolveHeroAnimTrack,
  resolvePlayerFacing, resolvePoseSnapshot, resolveWeaponChargeTint, skinTint, solveLegacyArmRigForSnap,
  syncBowAimGuide, syncSubmergedSprite, syncWaterSubmergeState, type ActivePose,
} from "./playerPoseHelpers.js";

const EMPTY_ARMOR: ArmorEquipment = { head: null, chest: null, legs: null, feet: null, offhand: null };

const BACK_BOW_DIRS = new Set<FacingDir>(["north", "ne"]);
const PLAYER_SOLE_OFFSET_PX = 2.6;

export class PlayerView {
  readonly root = new Container();
  private readonly groundShadow = makeGroundShadow();
  private readonly waterRig = createWaterSubmergeRig(PLAYER_WATERLINE, true);
  private readonly actorGroup = new Container();
  private readonly backSlot = new Container();
  private readonly frontSlot = new Container();
  private readonly body: Sprite;
  private readonly bowOverlaySprite = new Sprite();
  private readonly bowAimGuide = new Graphics();
  private readonly heldGroup = new Container();
  private readonly weaponSprite = new Sprite();
  private readonly handSprite = makeHandSprite();
  private readonly secondaryHandSprite = makeHandSprite();
  private readonly offhandGroup = new Container();
  private readonly offhandSprite = new Sprite();
  private readonly offhandHandSprite = makeHandSprite();
  private readonly rightArmSprite = makeArmSprite();
  private readonly leftArmSprite = makeArmSprite();
  private readonly shieldSprite = makeShieldSprite();
  private readonly webOverlay = new Graphics();
  private readonly hpBar = new PlayerHpBar();
  private readonly label: Text;
  private appearanceKey = "";
  private cacheRev = -1;
  private sprites: CharacterSpriteSet;
  private lastFacing: { readonly dir: FacingDir; readonly flipX: boolean } = { dir: "south", flipX: false };
  private dodgeStartSec: number | null = null;
  private readonly gaitClock = createGaitClock();

  constructor(_torchTex: Texture, snap: PlayerSnapshot) {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const armor = snap.armor ?? EMPTY_ARMOR;
    this.appearanceKey = characterCacheKey(appearance, armor);
    this.cacheRev = getCharacterCacheRevision();
    this.sprites = getCharacterSpriteSet(appearance, armor);
    this.body = new Sprite(this.sprites.south.idle[0]);
    this.applyBodyMetrics();
    this.backSlot.sortableChildren = true; this.frontSlot.sortableChildren = true;
    this.bowOverlaySprite.visible = false; this.bowOverlaySprite.zIndex = 2;
    this.heldGroup.addChild(this.weaponSprite, this.handSprite, this.secondaryHandSprite);
    this.heldGroup.visible = false; this.heldGroup.zIndex = 2;
    this.offhandGroup.addChild(this.offhandSprite, this.offhandHandSprite);
    this.offhandGroup.visible = false; this.offhandGroup.zIndex = 2;
    this.label = createPlayerNameLabel(snap.name);
    this.webOverlay.zIndex = 4; this.frontSlot.addChild(this.webOverlay);
    this.actorGroup.addChild(this.backSlot, this.body, this.frontSlot);
    const w = this.waterRig;
    this.root.addChild(this.groundShadow, this.bowAimGuide, w.submergedMask, w.submergedBody!, w.waterRing, w.waterMask, this.actorGroup, w.waterFrontLip, this.hpBar.root, this.label);
  }

  sync(input: {
    readonly snap: PlayerSnapshot; readonly torchFrames: readonly Texture[];
    readonly timeSec: number; readonly visualElev?: number; readonly sortBoost?: number;
  }): void {
    const { snap, timeSec } = input;
    const elev = input.visualElev ?? snap.elevation;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX - elev * ELEVATION_LIFT_PX);
    this.root.zIndex = Math.round(snap.y * TILE_PX) + (input.sortBoost ?? snap.elevation * 2);
    this.syncAppearanceSet(snap);
    this.syncBodyTransform(snap, timeSec);
    const gait = advanceGaitClock(this.gaitClock, { x: snap.x, y: snap.y, moving: snap.moving, sprinting: Boolean(snap.sprinting), airborne: (snap.jumpZ ?? 0) > 0.03 });
    const activePose = this.syncPose(snap, timeSec, gait.phase);
    this.syncSubmerged(Boolean(snap.inDeepWater && (snap.jumpZ ?? 0) <= 0.03));
    this.syncGear({ snap, active: activePose, timeSec, gaitPhase: gait.phase });
  }

  private applyBodyMetrics(): void {
    const scale = this.sprites.worldScale ?? CHARACTER_WORLD_SCALE;
    const ay = this.sprites.anchorY ?? 0.91;
    this.body.anchor.set(0.5, ay); this.waterRig.submergedBody?.anchor.set(0.5, ay);
    this.body.scale.set(scale); this.bowOverlaySprite.anchor.set(0.5, ay);
  }

  private syncSubmerged(swimming: boolean): void {
    syncSubmergedSprite({
      sub: this.waterRig.submergedBody, src: this.body, swimming,
      x: this.actorGroup.position.x, y: this.actorGroup.position.y, rot: this.actorGroup.rotation,
      scaleX: this.body.scale.x * this.actorGroup.scale.x, scaleY: this.body.scale.y * this.actorGroup.scale.y,
      alpha: this.actorGroup.alpha,
    });
  }

  private syncBodyTransform(snap: PlayerSnapshot, timeSec: number): void {
    const jumpZ = snap.jumpZ ?? 0;
    const jumpPx = jumpZ * JUMP_VISUAL_PX_PER_TILE;
    const swimming = Boolean(snap.inDeepWater && jumpZ <= 0.03);
    const fx = computePlayerCombatFx(snap, timeSec, Boolean(this.sprites.is3d));
    this.applyActorFx({ fx, jumpZ, jumpPx, swimming, timeSec });
    this.weaponSprite.tint = resolveWeaponChargeTint(snap.heavyCharge, timeSec, fx.tint);
    drawPlayerWebOverlay({ g: this.webOverlay, webStick: snap.webStick ?? 0, cocoonProgress: snap.cocoonProgress ?? 0, timeSec });
    this.applyCrouchScaleAndAlpha(snap, fx.alpha);
    const barVisible = this.hpBar.sync({ snap, jumpPx, timeSec });
    this.label.position.y = (barVisible ? -32 : -27) - jumpPx;
  }

  private applyCrouchScaleAndAlpha(snap: PlayerSnapshot, baseAlpha: number): void {
    const hasCrouchClip = Boolean(this.sprites.is3d && this.sprites.south.crouchIdle?.length);
    this.actorGroup.scale.set(1, snap.crouching && !hasCrouchClip ? 0.88 : 1);
    if (snap.crouching && snap.inCover) this.actorGroup.alpha = baseAlpha * 0.68;
  }

  private applyActorFx(opts: {
    readonly fx: ReturnType<typeof computeActorCombatFx>; readonly jumpZ: number; readonly jumpPx: number;
    readonly swimming: boolean; readonly timeSec: number;
  }): void {
    const { fx, jumpZ, jumpPx, swimming, timeSec } = opts;
    this.actorGroup.position.set(fx.x, PLAYER_SOLE_OFFSET_PX - jumpPx + fx.y + computeSwimDip(swimming, timeSec));
    this.actorGroup.alpha = fx.alpha; this.actorGroup.rotation = fx.rot;
    syncWaterSubmergeState({ rig: this.waterRig, target: this.actorGroup, shadow: this.groundShadow, swimming, showShadow: !swimming });
    this.body.tint = fx.tint; this.bowOverlaySprite.tint = fx.tint;
    this.rightArmSprite.tint = fx.tint; this.leftArmSprite.tint = fx.tint;
    this.groundShadow.scale.set(Math.max(0.55, 1 - jumpZ * 0.65));
    this.groundShadow.alpha = Math.max(0.45, 1 - jumpZ * 0.7);
  }

  private syncAppearanceSet(snap: PlayerSnapshot): void {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const armor = snap.armor ?? EMPTY_ARMOR;
    const key = characterCacheKey(appearance, armor);
    const rev = getCharacterCacheRevision();
    if (key === this.appearanceKey && rev === this.cacheRev) return;
    this.appearanceKey = key; this.cacheRev = rev;
    this.sprites = getCharacterSpriteSet(appearance, armor);
    this.applyBodyMetrics();
  }

  private syncPose(snap: PlayerSnapshot, timeSec: number, gaitPhase: number): ActivePose {
    if (this.label.text !== snap.name) this.label.text = snap.name;
    const is3d = Boolean(this.sprites.is3d);
    const facing = resolvePlayerFacing({ snap, is3d, prev: this.lastFacing });
    if (is3d) this.lastFacing = facing;
    this.dodgeStartSec = nextDodgeStart(snap.dodging, timeSec, this.dodgeStartSec);
    const anim = resolveHeroAnimTrack(this.sprites, facing.dir);
    const { active, texture } = resolvePoseSnapshot({ anim, facing, snap, is3d, timeSec, dodgeStartSec: this.dodgeStartSec, gaitPhase });
    if (texture) this.body.texture = texture;
    const scale = this.sprites.worldScale ?? CHARACTER_WORLD_SCALE;
    this.body.scale.set(facing.flipX ? -scale : scale, scale);
    return active;
  }

  private syncGear(opts: { readonly snap: PlayerSnapshot; readonly active: ActivePose; readonly timeSec: number; readonly gaitPhase: number }): void {
    const { snap, active, timeSec, gaitPhase } = opts;
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const handTex = getGrippingHandTexture(appearance.body === "female");
    this.handSprite.texture = handTex; this.secondaryHandSprite.texture = handTex; this.offhandHandSprite.texture = handTex;
    const hideGear = (snap.respawnTimer ?? 0) > 0 || Boolean(this.sprites.is3d && snap.dodging);
    syncBowAimGuide(this.bowAimGuide, snap, hideGear);
    if (hideGear) { this.hideAllGearAndArms(); return; }
    const visual = getHeldWeaponVisual(snap.heldItem, timeSec, snap.bowCharge);
    const layout = gearLayoutFor({ snap, visual, timeSec, is3d: Boolean(this.sprites.is3d), active, gaitPhase });
    const handTint = skinTint(appearance.skin);
    const showHands = !this.sprites.is3d;
    this.syncMainHand({ snap, active, tint: handTint, visual, main: layout.main, showGripHands: showHands });
    this.syncOffhand({ tint: handTint, off: layout.offhand, timeSec, showHand: showHands });
    this.syncShield(layout.shield);
    if (this.sprites.is3d) { this.rightArmSprite.visible = false; this.leftArmSprite.visible = false; return; }
    const rig = solveLegacyArmRigForSnap({ snap, active, layout, visual });
    this.syncArm(this.rightArmSprite, rig.right); this.syncArm(this.leftArmSprite, rig.left);
  }

  private hideAllGearAndArms(): void {
    this.heldGroup.visible = false; this.bowOverlaySprite.visible = false; this.offhandGroup.visible = false;
    this.shieldSprite.visible = false;
    this.rightArmSprite.visible = false; this.leftArmSprite.visible = false;
  }

  private syncShield(shield: ShieldPlacement): void {
    if (!shield.equipped) { this.shieldSprite.visible = false; return; }
    const scale = this.sprites.is3d ? getGearScale("gear-shield") : CHARACTER_WORLD_SCALE;
    this.shieldSprite.texture = getShieldTexture();
    this.shieldSprite.position.set(shield.x, shield.y); this.shieldSprite.rotation = shield.rotation;
    this.shieldSprite.scale.set(Math.sign(shield.scaleX) * scale, scale); this.shieldSprite.visible = true;
    attachToSlot(shield.behindBody ? this.backSlot : this.frontSlot, this.shieldSprite);
  }

  private syncArm(sprite: Sprite, arm: ArmPlacement): void {
    sprite.texture = arm.shaded ? this.sprites.backArm : this.sprites.frontArm;
    sprite.position.set(arm.x, arm.y); sprite.rotation = arm.rotation;
    sprite.scale.set(arm.scaleX, arm.scaleY); sprite.zIndex = arm.overWeapon ? 3 : 1; sprite.visible = true;
    attachToSlot(arm.behindBody ? this.backSlot : this.frontSlot, sprite);
  }

  private tryMount3dBowOverlay(snap: PlayerSnapshot, active: ActivePose): boolean {
    if (!this.sprites.is3d || snap.heldItem !== "bow" || active.clip !== "bow") return false;
    const bowTex = getBowOverlayTexture(active.dir, active.frameIdx);
    if (!bowTex) return false;
    const scale = this.sprites.worldScale ?? CHARACTER_WORLD_SCALE;
    this.bowOverlaySprite.texture = bowTex;
    this.bowOverlaySprite.scale.set(active.flipX ? -scale : scale, scale);
    this.bowOverlaySprite.visible = true;
    attachToSlot(BACK_BOW_DIRS.has(active.dir) ? this.backSlot : this.frontSlot, this.bowOverlaySprite);
    return true;
  }

  private syncMainHand(opts: {
    readonly snap: PlayerSnapshot; readonly active: ActivePose; readonly tint: number;
    readonly visual: HeldWeaponVisual | null; readonly main: HeldLayout["main"]; readonly showGripHands: boolean;
  }): void {
    const { snap, active, tint, visual, main, showGripHands } = opts;
    if (this.tryMount3dBowOverlay(snap, active)) { this.heldGroup.visible = false; return; }
    this.bowOverlaySprite.visible = false;
    if (!visual) { this.heldGroup.visible = false; return; }
    this.weaponSprite.texture = visual.texture; this.weaponSprite.anchor.set(visual.anchorX, visual.anchorY);
    this.handSprite.visible = showGripHands && visual.grips.primary.showHand;
    this.handSprite.position.set(visual.grips.primary.x, visual.grips.primary.y); this.handSprite.tint = tint;
    const sec = visual.grips.secondary;
    this.secondaryHandSprite.visible = showGripHands && Boolean(sec?.showHand);
    if (sec) this.secondaryHandSprite.position.set(sec.x, sec.y);
    this.secondaryHandSprite.tint = tint;
    this.heldGroup.position.set(main.x, main.y); this.heldGroup.rotation = main.rotation;
    this.heldGroup.scale.set(main.scaleX, main.scaleY); this.heldGroup.visible = true;
    attachToSlot(main.behindBody ? this.backSlot : this.frontSlot, this.heldGroup);
  }

  private syncOffhand(opts: { readonly tint: number; readonly off: OffhandPlacement; readonly timeSec: number; readonly showHand: boolean }): void {
    const { tint, off, timeSec, showHand } = opts;
    if (off.kind === "none") { this.offhandGroup.visible = false; return; }
    const frames = getWaistLanternFrames();
    const scale = this.sprites.is3d ? getGearScale("gear-lantern-0") : CHARACTER_WORLD_SCALE;
    const tex = frames[Math.floor(timeSec * 4) % frames.length];
    if (tex) this.offhandSprite.texture = tex;
    this.offhandSprite.anchor.set(0.5, off.kind === "handLantern" ? 0.18 : 0.5);
    this.offhandHandSprite.visible = showHand && off.kind === "handLantern";
    this.offhandHandSprite.tint = tint;
    this.offhandGroup.scale.set(scale); this.offhandGroup.position.set(off.x, off.y);
    this.offhandGroup.rotation = off.rotation; this.offhandGroup.visible = true;
    attachToSlot(off.behindBody ? this.backSlot : this.frontSlot, this.offhandGroup);
  }
}
